import { useRef, useState } from 'react';
import Screen from '../components/Screen';
import { actions, getDb, useDb } from '../lib/store';
import { downloadBlob } from '../lib/share';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import type { Db } from '../types';
import { fmtDateTime } from '../lib/calc';
import { isConfigured, pendingCount, pullHistory, restoreCatalog, setSyncConfig, syncNow, useSync } from '../lib/sync';

export default function Settings() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const sync = useSync();
  const pending = pendingCount(db, sync);
  const [busy, setBusy] = useState(false);

  const status = !isConfigured()
    ? 'Не настроено: введите ключ доступа'
    : sync.lastError
      ? `Ошибка: ${sync.lastError}`
      : pending > 0
        ? `Ожидает отправки: ${pending}`
        : sync.lastOk
          ? `Всё отправлено · ${fmtDateTime(sync.lastOk)}`
          : 'Настроено, ещё не отправляли';

  const run = async (job: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.show(await job());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    const blob = new Blob([JSON.stringify(getDb(), null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    try {
      await downloadBlob(blob, `bar-inventory-backup_${stamp}.json`);
      toast.show('Резервная копия готова');
    } catch (e) {
      console.error(e);
      toast.show('Не удалось сохранить копию');
    }
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Db;
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.sessions)) {
        toast.show('Файл не похож на резервную копию');
        return;
      }
      if (!(await confirm('Текущие данные будут заменены данными из файла. Продолжить?', { okLabel: 'Заменить' }))) return;
      actions.replaceDb(parsed);
      toast.show('Данные восстановлены');
    } catch (e) {
      console.error(e);
      toast.show('Не удалось прочитать файл');
    }
  };

  return (
    <Screen title="Настройки">
      <section className="card col">
        <label className="field">
          Кто обычно считает
          <input
            className="input"
            placeholder="Имя по умолчанию"
            value={db.settings.author}
            onChange={(e) => actions.setSettings({ author: e.target.value })}
          />
        </label>
      </section>

      <div className="section-title">Сервер (история пересчётов)</div>
      <section className="card col">
        <p className="small muted" style={{ margin: 0 }}>
          Каждый завершённый пересчёт сам уходит на сервер и хранится там. Нет связи — отправится позже.
        </p>
        <label className="field">
          Адрес сервера
          <input className="input" value={sync.url} onChange={(e) => setSyncConfig({ url: e.target.value })} autoCapitalize="none" autoCorrect="off" />
        </label>
        <label className="field">
          Ключ доступа
          <input className="input" type="password" value={sync.token} onChange={(e) => setSyncConfig({ token: e.target.value })} autoCapitalize="none" autoCorrect="off" />
        </label>
        <div className={`small ${sync.lastError ? 'danger' : 'muted'}`}>{status}</div>
        <button
          className="btn primary block"
          disabled={busy || !isConfigured()}
          onClick={() =>
            void run(async () => {
              const r = await syncNow();
              if (!r.ok) throw new Error(r.error);
              return r.sent ? `Отправлено пересчётов: ${r.sent}` : 'Всё уже на сервере';
            })
          }
        >
          Отправить сейчас
        </button>
        <button
          className="btn block"
          disabled={busy || !isConfigured()}
          onClick={() => void run(async () => `Загружено пересчётов: ${(await pullHistory()).added}`)}
        >
          Загрузить историю с сервера
        </button>
        <button
          className="btn block ghost"
          disabled={busy || !isConfigured()}
          onClick={() =>
            void run(async () => {
              const ok = await confirm('Справочник, журнал и настройки на этом устройстве будут заменены копией с сервера. Пересчёты не затрагиваются.', { okLabel: 'Заменить' });
              if (!ok) return 'Отменено';
              return (await restoreCatalog()) ? 'Справочник и журнал восстановлены' : 'На сервере пока нет копии';
            })
          }
        >
          Восстановить справочник и журнал
        </button>
      </section>

      <div className="section-title">Данные</div>
      <section className="card col">
        <p className="small muted" style={{ margin: 0 }}>
          Всё хранится только на этом устройстве, никакой синхронизации с бухгалтерией нет.
          Сейчас в базе: {db.products.length} позиций, {db.categories.length} разделов, {db.sessions.length} пересчётов.
        </p>
        <button className="btn block" onClick={() => void exportBackup()}>
          ⬇️ Сохранить резервную копию (.json)
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>
          ⬆️ Восстановить из копии
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBackup(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn block ghost danger"
          onClick={async () => {
            if (!(await confirm('Сбросить ВСЁ: справочник и все пересчёты — к тестовым данным?', { okLabel: 'Сбросить' }))) return;
            actions.resetToSeed();
            toast.show('Данные сброшены к тестовым');
          }}
        >
          Сбросить всё к тестовым данным
        </button>
      </section>

      <div className="section-title">О приложении</div>
      <section className="card col small muted">
        <span>Инвентаризация бара · версия 0.1</span>
        <span>
          Сайт собран так, чтобы его можно было без переделок упаковать в Android-приложение (Capacitor).
          Инструкция — в файле README.md в папке проекта.
        </span>
      </section>
    </Screen>
  );
}
