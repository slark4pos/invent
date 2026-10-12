// Сервер истории пересчётов: хранит завершённые пересчёты и копию справочника.
// Без внешних зависимостей, работает на Node 18+.
//   TOKEN=<ключ, от 24 символов> DATA_DIR=./data node index.mjs
import http from 'node:http';
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA = process.env.DATA_DIR ?? './data';
const TOKEN = process.env.TOKEN ?? '';
if (TOKEN.length < 24) {
  console.error('Нужна переменная TOKEN длиной от 24 символов');
  process.exit(1);
}

const SESSIONS = path.join(DATA, 'sessions');
const VERSIONS = path.join(DATA, 'versions'); // прежние версии пересчёта, если его перезаписали
const CATALOG = path.join(DATA, 'catalog');
const MAX_BODY = 10 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const token = Buffer.from(TOKEN);

const CORS = {
  'Access-Control-Allow-Origin': '*', // доступ только по ключу, куки не используются
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/* ---------- защита от подбора ключа ---------- */
const fails = new Map();
const isBlocked = (ip) => {
  const f = fails.get(ip);
  return Boolean(f && f.n >= 10 && Date.now() < f.until);
};
const noteFail = (ip) => {
  const f = fails.get(ip);
  const now = Date.now();
  if (!f || now > f.until) fails.set(ip, { n: 1, until: now + 10 * 60_000 });
  else f.n += 1;
};

function authorized(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  return given.length === token.length && timingSafeEqual(given, token);
}

/* ---------- вспомогательное ---------- */
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS });
  res.end(JSON.stringify(body));
};

const fail = (status, message) => Object.assign(new Error(message), { status });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Лишнее не копим; соединение закроем после ответа, см. обработчик ошибок ниже.
        if (!tooLarge) reject(fail(413, 'Слишком большой запрос'));
        tooLarge = true;
      } else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJson(req) {
  const text = await readBody(req);
  try {
    return JSON.parse(text);
  } catch {
    throw fail(400, 'Некорректный JSON');
  }
}

/** Пишем во временный файл и переименовываем: при сбое питания файл не окажется оборванным. */
async function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, file);
}

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const exists = (file) => readFile(file).then(() => true, () => false);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ---------- маршруты ---------- */
async function handle(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'sessions', ':id']

  if (url.pathname === '/health') return send(res, 200, { ok: true });
  if (parts[0] !== 'api') throw fail(404, 'Не найдено');

  // GET /api/sessions — краткий список
  if (parts[1] === 'sessions' && parts.length === 2 && req.method === 'GET') {
    const files = (await readdir(SESSIONS)).filter((f) => f.endsWith('.json'));
    const list = [];
    for (const f of files) {
      try {
        const s = await readJson(path.join(SESSIONS, f));
        list.push({ id: s.id, createdAt: s.createdAt, finishedAt: s.finishedAt ?? null, status: s.status, author: s.author ?? null, note: s.note ?? null });
      } catch (e) {
        console.error('Пропускаю повреждённый файл', f, e.message);
      }
    }
    return send(res, 200, list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  }

  // GET|PUT /api/sessions/:id
  if (parts[1] === 'sessions' && parts.length === 3) {
    const id = parts[2];
    if (!ID_RE.test(id)) throw fail(400, 'Недопустимый id');
    const file = path.join(SESSIONS, `${id}.json`);

    if (req.method === 'GET') {
      if (!(await exists(file))) throw fail(404, 'Пересчёт не найден');
      return send(res, 200, await readJson(file));
    }
    if (req.method === 'PUT') {
      const s = await parseJson(req);
      if (!isObject(s) || s.id !== id || typeof s.createdAt !== 'string' || !['draft', 'finished'].includes(s.status) || !Array.isArray(s.products) || !isObject(s.entries)) {
        throw fail(422, 'Это не похоже на пересчёт');
      }
      if (await exists(file)) await copyFile(file, path.join(VERSIONS, `${id}.${Date.now()}.json`));
      await writeAtomic(file, JSON.stringify(s));
      return send(res, 200, { ok: true });
    }
  }

  // PUT /api/backup — копия справочника, журнала и настроек; GET /api/backup/latest — последняя
  if (parts[1] === 'backup') {
    if (parts.length === 2 && req.method === 'PUT') {
      const b = await parseJson(req);
      if (!isObject(b) || !Array.isArray(b.categories) || !Array.isArray(b.products)) throw fail(422, 'Это не похоже на копию справочника');
      const text = JSON.stringify(b);
      await writeAtomic(path.join(CATALOG, 'latest.json'), text);
      await writeAtomic(path.join(CATALOG, `catalog-${new Date().toISOString().slice(0, 10)}.json`), text);
      return send(res, 200, { ok: true });
    }
    if (parts[2] === 'latest' && req.method === 'GET') {
      const file = path.join(CATALOG, 'latest.json');
      if (!(await exists(file))) throw fail(404, 'Копии пока нет');
      return send(res, 200, await readJson(file));
    }
  }

  throw fail(404, 'Не найдено');
}

const server = http.createServer(async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    if (url.pathname.startsWith('/api')) {
      if (isBlocked(ip)) throw fail(429, 'Слишком много неверных попыток, подождите 10 минут');
      if (!authorized(req)) {
        noteFail(ip);
        throw fail(401, 'Неверный ключ доступа');
      }
    }
    await handle(req, res, url);
  } catch (e) {
    const status = e.status ?? 500;
    if (status === 500) console.error(e);
    if (status === 413) res.on('finish', () => req.destroy());
    send(res, status, { error: status === 500 ? 'Ошибка сервера' : e.message });
  }
});

await Promise.all([SESSIONS, VERSIONS, CATALOG].map((dir) => mkdir(dir, { recursive: true })));
server.listen(PORT, HOST, () => console.log(`Сервер слушает ${HOST}:${PORT}, данные: ${path.resolve(DATA)}`));
