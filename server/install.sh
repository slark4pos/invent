#!/usr/bin/env bash
# Установка сервера истории пересчётов на Ubuntu/Debian. Запускать от root:
#   curl -fsSL https://raw.githubusercontent.com/slark4pos/invent/main/server/install.sh | bash -s -- 157.228.190.62
# Скрипт можно запускать повторно: он обновит сервер, а ключ доступа и данные сохранит.
set -euo pipefail

REPO_URL="https://github.com/slark4pos/invent.git"
APP_DIR=/opt/mimino
DATA_DIR=/var/lib/mimino
ENV_DIR=/etc/mimino
ENV_FILE="$ENV_DIR/server.env"
BACKUP_DIR=/var/backups/mimino

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root (sudo -i)"; exit 1; }
. /etc/os-release
case "${ID:-}" in ubuntu | debian) ;; *) echo "Нужна Ubuntu или Debian, сейчас: ${ID:-неизвестно}"; exit 1 ;; esac

IP="${1:-$(curl -4fsS https://api.ipify.org 2>/dev/null || true)}"
[ -n "$IP" ] || { echo "Не удалось определить IP. Запустите: bash install.sh ВАШ_IP"; exit 1; }
DOMAIN="${IP//./-}.sslip.io"   # бесплатный адрес, который указывает на этот IP; нужен для HTTPS
echo "==> Адрес сервера будет: https://$DOMAIN"

echo "==> Устанавливаю пакеты"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a   # без интерактивных вопросов
# </dev/null: apt не должен читать из канала, по которому приходит сам скрипт
apt-get update -y </dev/null
apt-get install -y nodejs git curl ufw caddy openssl </dev/null
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "Нужен Node 18+, установлен $NODE_MAJOR"; exit 1; }

echo "==> Пользователь и папки"
id mimino >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin mimino
mkdir -p "$DATA_DIR" "$ENV_DIR" "$BACKUP_DIR"
chown -R mimino:mimino "$DATA_DIR"

echo "==> Скачиваю сервер"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

echo "==> Ключ доступа"
if [ ! -f "$ENV_FILE" ]; then
  ( umask 077
    printf 'TOKEN=%s\nDATA_DIR=%s\nPORT=3000\nHOST=127.0.0.1\n' "$(openssl rand -hex 32)" "$DATA_DIR" > "$ENV_FILE" )
  echo "создан новый"
else
  echo "оставляю прежний"
fi

echo "==> Служба mimino"
cat > /etc/systemd/system/mimino.service <<UNIT
[Unit]
Description=Mimino inventory history server
After=network.target

[Service]
User=mimino
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/server/index.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable mimino >/dev/null
systemctl restart mimino

echo "==> HTTPS (Caddy)"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null
systemctl restart caddy

echo "==> Файрвол (SSH, 80, 443)"
# Порты SSH берём из настроек sshd (а не угадываем), чтобы файрвол не отрезал вас от сервера.
SSH_PORTS="$( (sshd -T 2>/dev/null | awk '/^port /{print $2}') || true)"
for port in ${SSH_PORTS:-22} 22; do ufw allow "$port/tcp" >/dev/null; done
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> Ежедневная копия данных (хранится 30 дней)"
cat > /etc/cron.daily/mimino-backup <<'CRON'
#!/bin/sh
tar czf /var/backups/mimino/data-$(date +%F).tgz -C /var/lib/mimino .
find /var/backups/mimino -name 'data-*.tgz' -mtime +30 -delete
CRON
chmod +x /etc/cron.daily/mimino-backup

echo "==> Проверка"
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:3000/health >/dev/null || { echo "Сервер не запустился: journalctl -u mimino -n 30"; exit 1; }
echo "Сервер работает локально."
HTTPS_OK=0
for i in $(seq 1 45); do
  if curl -fsS "https://$DOMAIN/health" >/dev/null 2>&1; then HTTPS_OK=1; break; fi
  sleep 2
done

TOKEN="$(grep '^TOKEN=' "$ENV_FILE" | cut -d= -f2)"
echo
echo "=============================================="
if [ "$HTTPS_OK" -eq 1 ]; then echo " ГОТОВО. HTTPS работает."; else
  echo " Сервер установлен, но HTTPS пока не отвечает (сертификат может выпускаться до пары минут)."
  echo " Проверить позже: curl https://$DOMAIN/health   |   лог: journalctl -u caddy -n 30"
  echo " Если не заработает: у хостинга должны быть открыты порты 80 и 443."
fi
echo " Адрес сервера:  https://$DOMAIN"
echo " Ключ доступа:   $TOKEN"
echo " (ключ можно показать снова: cat $ENV_FILE)"
echo "=============================================="
