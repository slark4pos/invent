import { useSyncExternalStore } from 'react';
import type { Cell, Category, Db, LocationDef, Movement, Product, Session, Unit } from '../types';
import { SEED_VERSION, makeSeedDb } from '../data/seed';
import { categoryColor } from './colors';
import { buildWriteoffSnapshot } from './movements';

const KEY = 'bar-inventory/db/v1';

/**
 * Хранилище — обычный localStorage: никакой бухгалтерии и серверов,
 * данные живут только на устройстве. В Android-сборке Capacitor отдаёт
 * тот же localStorage, поэтому код переносится без изменений.
 */
/** Приходы и продажи из журнала убрали — в старых данных оставляем только списания. */
function onlyWriteoffs(list: Movement[] | undefined): Movement[] {
  return (list ?? []).filter((m) => m.kind === 'writeoff');
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeSeedDb();
    const parsed = JSON.parse(raw) as Db;
    if (!parsed || !Array.isArray(parsed.categories)) return makeSeedDb();
    // Структура справочника изменилась (появились единицы измерения и «обозначение
    // товара») — старые данные не пересчитать корректно, берём свежий справочник.
    if (parsed.version !== SEED_VERSION) return makeSeedDb();
    // Журнал появился позже первых версий — старые данные не теряем, просто добавляем пустой.
    parsed.movements = onlyWriteoffs(parsed.movements);
    return parsed;
  } catch {
    return makeSeedDb();
  }
}

let db: Db = read();
const listeners = new Set<() => void>();

function commit(next: Db) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Не удалось сохранить данные', e);
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, () => db);
}

export function getDb(): Db {
  return db;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------------- справочники ---------------- */

export const actions = {
  setSettings(patch: Partial<Db['settings']>) {
    commit({ ...db, settings: { ...db.settings, ...patch } });
  },

  addCategory(name: string, emoji: string) {
    const order = Math.max(0, ...db.categories.map((c) => c.order)) + 1;
    const next: Category = {
      id: uid('cat'),
      name: name.trim() || 'Без названия',
      emoji: emoji || '🍶',
      order,
      color: categoryColor(order),
    };
    commit({ ...db, categories: [...db.categories, next] });
  },

  updateCategory(id: string, patch: Partial<Category>) {
    commit({ ...db, categories: db.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  },

  removeCategory(id: string) {
    commit({
      ...db,
      categories: db.categories.filter((c) => c.id !== id),
      products: db.products.filter((p) => p.categoryId !== id),
    });
  },

  addProduct(categoryId: string, name: string, tag: string, unit: Unit, volumeMl: number) {
    const next: Product = { id: uid('p'), categoryId, name: name.trim(), tag: tag.trim(), unit, volumeMl };
    commit({ ...db, products: [...db.products, next] });
    return next;
  },

  updateProduct(id: string, patch: Partial<Product>) {
    commit({ ...db, products: db.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  },

  removeProduct(id: string) {
    commit({ ...db, products: db.products.filter((p) => p.id !== id) });
  },

  addLocation(name: string) {
    const next: LocationDef = { id: uid('loc'), name: name.trim() || 'Новая точка' };
    commit({ ...db, locations: [...db.locations, next] });
  },

  updateLocation(id: string, name: string) {
    commit({ ...db, locations: db.locations.map((l) => (l.id === id ? { ...l, name } : l)) });
  },

  removeLocation(id: string) {
    if (db.locations.length <= 1) return;
    commit({ ...db, locations: db.locations.filter((l) => l.id !== id) });
  },

  /* ---------------- пересчёты ---------------- */

  /** Создаёт черновик со снимком справочников и возвращает его id. */
  startSession(): string {
    const session: Session = {
      id: uid('inv'),
      createdAt: new Date().toISOString(),
      status: 'draft',
      author: db.settings.author || undefined,
      locations: db.locations.map((l) => ({ ...l })),
      categories: db.categories.map((c) => ({ ...c })),
      products: db.products.filter((p) => !p.archived).map((p) => ({ ...p })),
      entries: {},
    };
    commit({ ...db, sessions: [session, ...db.sessions] });
    return session.id;
  },

  patchSession(id: string, patch: Partial<Session>) {
    commit({ ...db, sessions: db.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  },

  setCell(sessionId: string, productId: string, locationId: string, cell: Cell) {
    commit({
      ...db,
      sessions: db.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const forProduct = { ...(s.entries[productId] ?? {}) };
        forProduct[locationId] = cell;
        return { ...s, entries: { ...s.entries, [productId]: forProduct } };
      }),
    });
  },

  clearProduct(sessionId: string, productId: string) {
    commit({
      ...db,
      sessions: db.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const entries = { ...s.entries };
        delete entries[productId];
        return { ...s, entries };
      }),
    });
  },

  finishSession(id: string) {
    const target = db.sessions.find((s) => s.id === id);
    if (!target) return;
    const finishedAt = new Date().toISOString();
    // Списания за период фиксируем в пересчёте: правки журнала потом не меняют старый отчёт.
    const writeoffs = buildWriteoffSnapshot(db, target, finishedAt);
    commit({
      ...db,
      sessions: db.sessions.map((s) => (s.id === id ? { ...s, status: 'finished', finishedAt, writeoffs } : s)),
    });
  },

  reopenSession(id: string) {
    commit({
      ...db,
      sessions: db.sessions.map((s) =>
        s.id === id ? { ...s, status: 'draft', finishedAt: undefined, writeoffs: undefined } : s,
      ),
    });
  },

  removeSession(id: string) {
    commit({ ...db, sessions: db.sessions.filter((s) => s.id !== id) });
  },

  /* ---------------- журнал списаний ---------------- */

  addMovement(m: Omit<Movement, 'id' | 'at'>) {
    const next: Movement = { ...m, id: uid('mv'), at: new Date().toISOString() };
    commit({ ...db, movements: [next, ...db.movements] });
  },

  removeMovement(id: string) {
    commit({ ...db, movements: db.movements.filter((m) => m.id !== id) });
  },

  /* ---------------- резервная копия ---------------- */

  replaceDb(next: Db) {
    commit({ ...next, movements: onlyWriteoffs(next.movements) });
  },

  resetToSeed() {
    commit(makeSeedDb());
  },
};

export function findSession(id: string | undefined): Session | undefined {
  return db.sessions.find((s) => s.id === id);
}
