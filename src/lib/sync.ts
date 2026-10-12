import { useSyncExternalStore } from 'react';
import type { Db, Session } from '../types';
import { DEFAULT_SERVER_URL } from '../config';
import { actions, getDb } from './store';

/**
 * Связь с сервером истории. Адрес и ключ лежат отдельно от базы (в резервную копию
 * и экспорт они не попадают). Очередь не хранится: «ожидает отправки» — это просто завершённые
 * пересчёты, которых на сервере ещё нет.
 */
const KEY = 'bar-inventory/sync/v1';

type SyncState = {
  url: string;
  token: string;
  /** id пересчёта → его finishedAt на момент успешной отправки. */
  uploaded: Record<string, string>;
  backupHash?: string;
  lastOk?: string;
  lastError?: string;
};

function load(): SyncState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { url: DEFAULT_SERVER_URL, token: '', uploaded: {}, ...(JSON.parse(raw) as Partial<SyncState>) };
  } catch {
    /* повреждённые данные — начнём с чистого */
  }
  return { url: DEFAULT_SERVER_URL, token: '', uploaded: {} };
}

let state: SyncState = load();
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Не удалось сохранить настройки сервера', e);
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSync = (): SyncState => useSyncExternalStore(subscribe, () => state);
export const setSyncConfig = (patch: Pick<Partial<SyncState>, 'url' | 'token'>) => set(patch);
export const isConfigured = (): boolean => state.token.trim().length > 0 && state.url.trim().length > 0;

/** Сколько завершённых пересчётов ещё не ушло на сервер. */
export function pendingCount(db: Db, s: SyncState = state): number {
  return db.sessions.filter((x) => x.status === 'finished' && x.finishedAt && s.uploaded[x.id] !== x.finishedAt).length;
}

/* ---------------- запросы ---------------- */

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(state.url.trim().replace(/\/+$/, '') + path, {
      ...init,
      headers: { Authorization: `Bearer ${state.token.trim()}`, 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error('Нет связи с сервером');
  }
  if (res.status === 401) throw new Error('Неверный ключ доступа');
  if (res.status === 429) throw new Error('Слишком много неверных попыток, подождите 10 минут');
  if (!res.ok && res.status !== 404) throw new Error(`Сервер ответил ${res.status}`);
  return res;
}

const hash = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h);
};

/** Всё, кроме самих пересчётов: они хранятся на сервере отдельными файлами. */
const catalogBackup = (db: Db) => ({
  version: db.version,
  categories: db.categories,
  products: db.products,
  locations: db.locations,
  movements: db.movements,
  settings: db.settings,
});

export type SyncResult = { ok: boolean; sent: number; error?: string };

let running: Promise<SyncResult> | null = null;

async function runSync(): Promise<SyncResult> {
  try {
    const db = getDb();
    let sent = 0;
    for (const s of db.sessions) {
      if (s.status !== 'finished' || !s.finishedAt || state.uploaded[s.id] === s.finishedAt) continue;
      const res = await api(`/api/sessions/${encodeURIComponent(s.id)}`, { method: 'PUT', body: JSON.stringify(s) });
      if (!res.ok) throw new Error(`Сервер ответил ${res.status}`);
      set({ uploaded: { ...state.uploaded, [s.id]: s.finishedAt } });
      sent += 1;
    }

    const backup = JSON.stringify(catalogBackup(db));
    const h = hash(backup);
    if (h !== state.backupHash) {
      const res = await api('/api/backup', { method: 'PUT', body: backup });
      if (!res.ok) throw new Error(`Сервер ответил ${res.status}`);
      set({ backupHash: h });
    }

    set({ lastOk: new Date().toISOString(), lastError: undefined });
    return { ok: true, sent };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Ошибка связи';
    set({ lastError: error });
    return { ok: false, sent: 0, error };
  }
}

/**
 * Отправляет на сервер всё, чего там ещё нет. Безопасно вызывать сколько угодно раз:
 * параллельные вызовы делят один запуск.
 */
export function syncNow(): Promise<SyncResult> {
  if (!isConfigured()) return Promise.resolve({ ok: false, sent: 0, error: 'not-configured' });
  if (running) return running;
  // Сброс флага — через .finally: он срабатывает уже ПОСЛЕ присваивания, даже если запуск
  // завершился без единого ожидания (когда отправлять нечего).
  const job = runSync().finally(() => {
    running = null;
  });
  running = job;
  return job;
}

/** Докачивает с сервера пересчёты, которых нет на этом устройстве. Ничего не удаляет и не заменяет. */
export async function pullHistory(): Promise<{ added: number }> {
  try {
    const list = (await (await api('/api/sessions')).json()) as { id: string; finishedAt: string | null }[];
    const have = new Set(getDb().sessions.map((s) => s.id));
    const fresh: Session[] = [];
    for (const item of list) {
      if (have.has(item.id)) continue;
      const res = await api(`/api/sessions/${encodeURIComponent(item.id)}`);
      if (res.ok) fresh.push((await res.json()) as Session);
    }
    actions.mergeSessions(fresh);
    // Эти пересчёты уже на сервере — заново отправлять не нужно.
    const uploaded = { ...state.uploaded };
    for (const s of fresh) if (s.finishedAt) uploaded[s.id] = s.finishedAt;
    set({ uploaded, lastOk: new Date().toISOString(), lastError: undefined });
    return { added: fresh.length };
  } catch (e) {
    set({ lastError: e instanceof Error ? e.message : 'Ошибка связи' });
    throw e;
  }
}

/** Заменяет справочник, журнал и настройки копией с сервера (пересчёты не трогает). */
export async function restoreCatalog(): Promise<boolean> {
  const res = await api('/api/backup/latest');
  if (res.status === 404) return false;
  const backup = (await res.json()) as Parameters<typeof actions.restoreCatalog>[0];
  actions.restoreCatalog(backup);
  set({ backupHash: hash(JSON.stringify(backup)) });
  return true;
}

/** Запускать при старте и когда пропадала/появлялась связь. */
export function startAutoSync() {
  const run = () => void syncNow();
  run();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
}
