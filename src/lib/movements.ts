import type { Db, Product, Session, WriteoffSnapshot } from '../types';
import { amountInUnit, productTotals } from './calc';

/** Последний завершённый пересчёт — точка отсчёта для остатков. */
export function lastFinished(db: Db): Session | undefined {
  return db.sessions
    .filter((s) => s.status === 'finished' && s.finishedAt)
    .sort((a, b) => (b.finishedAt as string).localeCompare(a.finishedAt as string))[0];
}

/** Списания за период между предыдущим завершённым пересчётом и моментом `to`. */
export function buildWriteoffSnapshot(db: Db, session: Session, to: string): WriteoffSnapshot {
  const from = db.sessions
    .filter((s) => s.id !== session.id && s.status === 'finished' && s.finishedAt && s.finishedAt < session.createdAt)
    .map((s) => s.finishedAt as string)
    .sort()
    .pop();
  const items = db.movements
    .filter((m) => m.kind === 'writeoff' && (!from || m.at > from) && m.at <= to)
    .sort((a, b) => a.at.localeCompare(b.at));
  return { from, to, items };
}

/** Для завершённого пересчёта — снимок на момент завершения, для черновика — актуальные данные. */
export function sessionWriteoffs(db: Db, session: Session): WriteoffSnapshot {
  if (session.status === 'finished' && session.writeoffs) return session.writeoffs;
  return buildWriteoffSnapshot(db, session, session.finishedAt ?? new Date().toISOString());
}

export type StockRow = {
  product: Product;
  base: number;
  writeoff: number;
  now: number;
  moved: boolean;
};

/** Остаток = результат последнего пересчёта − списания, записанные после него. */
export function stockRows(db: Db): { baseline?: Session; rows: StockRow[] } {
  const baseline = lastFinished(db);
  if (!baseline) return { rows: [] };

  const since = baseline.finishedAt as string;
  const written = new Map<string, number>();
  for (const m of db.movements) {
    if (!m.productId || m.at <= since) continue;
    written.set(m.productId, (written.get(m.productId) ?? 0) + m.qty);
  }

  const rows = baseline.products.map((product) => {
    const base = amountInUnit(productTotals(baseline, product), product.unit);
    const writeoff = written.get(product.id) ?? 0;
    return { product, base, writeoff, now: base - writeoff, moved: writeoff > 0 };
  });
  return { baseline, rows };
}
