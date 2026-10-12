import type { Cell, Product, Session, Unit } from '../types';

export const emptyCell = (): Cell => ({ full: 0, open: [] });

export const unitLabel = (u: Unit): string => (u === 'ml' ? 'мл' : u === 'pcs' ? 'шт' : 'г');

/**
 * Итоги считаются сразу в трёх единицах, чтобы разделы и весь пересчёт
 * складывались без смешивания литров со штуками и граммами.
 */
export type Totals = {
  /** Полные бутылки (unit 'ml') или штуки (unit 'pcs'). */
  full: number;
  /** Сколько открытых бутылок (unit 'ml'). */
  openCount: number;
  /** Сумма остатков в открытых бутылках, мл. */
  openMl: number;
  ml: number;
  pcs: number;
  g: number;
  /** Эквивалент бутылок с дробью: 2 полных + 350 мл из 700 = 2,5 (unit 'ml'). */
  bottleEq: number;
};

const zero = (): Totals => ({ full: 0, openCount: 0, openMl: 0, ml: 0, pcs: 0, g: 0, bottleEq: 0 });

export function cellTotals(cell: Cell | undefined, product: Product): Totals {
  const c = cell ?? emptyCell();
  const t = zero();
  const full = Number.isFinite(c.full) ? c.full : 0;

  if (product.unit === 'ml') {
    t.full = full;
    t.openCount = c.open.length;
    t.openMl = c.open.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    t.ml = full * product.volumeMl + t.openMl;
    t.bottleEq = product.volumeMl > 0 ? t.ml / product.volumeMl : 0;
  } else if (product.unit === 'pcs') {
    t.full = full;
    t.pcs = full;
  } else {
    t.g = Number.isFinite(c.grams ?? 0) ? (c.grams ?? 0) : 0;
  }

  return t;
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    full: a.full + b.full,
    openCount: a.openCount + b.openCount,
    openMl: a.openMl + b.openMl,
    ml: a.ml + b.ml,
    pcs: a.pcs + b.pcs,
    g: a.g + b.g,
    bottleEq: a.bottleEq + b.bottleEq,
  };
}

export type ProductTotals = Totals & {
  byLocation: Record<string, Totals>;
  counted: boolean;
};

export function productTotals(session: Session, product: Product): ProductTotals {
  const row = session.entries[product.id];
  const byLocation: Record<string, Totals> = {};
  let sum = zero();

  for (const loc of session.locations) {
    const t = cellTotals(row?.[loc.id], product);
    byLocation[loc.id] = t;
    sum = addTotals(sum, t);
  }

  return {
    ...sum,
    byLocation,
    counted: Boolean(row && Object.keys(row).length > 0),
  };
}

/** Значение позиции в её собственной единице — то, что уходит в колонку «Остаток». */
export function amountInUnit(t: Totals, unit: Unit): number {
  return unit === 'ml' ? t.ml : unit === 'pcs' ? t.pcs : t.g;
}

export function isCounted(session: Session, productId: string): boolean {
  const row = session.entries[productId];
  return Boolean(row && Object.keys(row).length > 0);
}

export function productsOfCategory(session: Session, categoryId: string): Product[] {
  return session.products.filter((p) => p.categoryId === categoryId);
}

export type Progress = { counted: number; total: number; ratio: number };

export function categoryProgress(session: Session, categoryId: string): Progress {
  const list = productsOfCategory(session, categoryId);
  const counted = list.filter((p) => isCounted(session, p.id)).length;
  return { counted, total: list.length, ratio: list.length ? counted / list.length : 0 };
}

export function sessionProgress(session: Session): Progress {
  const total = session.products.length;
  const counted = session.products.filter((p) => isCounted(session, p.id)).length;
  return { counted, total, ratio: total ? counted / total : 0 };
}

export type CategorySummary = Totals & {
  categoryId: string;
  name: string;
  emoji: string;
  color: string;
  positions: number;
};

export function categorySummaries(session: Session): CategorySummary[] {
  return [...session.categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const list = productsOfCategory(session, c.id);
      const acc = list.reduce((a, p) => addTotals(a, productTotals(session, p)), zero());
      return { categoryId: c.id, name: c.name, emoji: c.emoji, color: c.color, positions: list.length, ...acc };
    });
}

export function sessionTotals(session: Session): Totals {
  return session.products.reduce((a, p) => addTotals(a, productTotals(session, p)), zero());
}

/* ---------------- форматирование ---------------- */

export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

export function fmtLiters(ml: number): string {
  return `${fmtNum(ml / 1000, 2)} л`;
}

export function fmtMl(ml: number): string {
  return `${fmtNum(ml)} мл`;
}

/** «12,5 л · 48 шт · 650 г» — только непустые части. */
export function fmtTotals(t: Totals): string {
  const parts: string[] = [];
  if (t.ml) parts.push(fmtLiters(t.ml));
  if (t.pcs) parts.push(`${fmtNum(t.pcs)} шт`);
  if (t.g) parts.push(`${fmtNum(t.g)} г`);
  return parts.length ? parts.join(' · ') : '0';
}

/** Итог одной позиции в её единице: «6,07 л», «38 шт», «250 г». */
export function fmtAmount(t: Totals, unit: Unit): string {
  if (unit === 'ml') return fmtLiters(t.ml);
  if (unit === 'pcs') return `${fmtNum(t.pcs)} шт`;
  return `${fmtNum(t.g)} г`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fileStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

/** Количество в единице позиции: «50 мл», «1,5 л», «12 шт», «250 г». */
export function fmtQty(qty: number, unit: Unit): string {
  if (unit === 'ml') return qty !== 0 && Math.abs(qty) < 1000 ? `${fmtNum(qty)} мл` : `${fmtNum(qty / 1000, 2)} л`;
  return `${fmtNum(qty, 2)} ${unit === 'pcs' ? 'шт' : 'г'}`;
}
