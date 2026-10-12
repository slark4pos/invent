import { useState } from 'react';
import type { CSSProperties } from 'react';
import Screen from '../components/Screen';
import { useDb } from '../lib/store';
import { stockRows } from '../lib/movements';
import { fmtDateTime, fmtQty } from '../lib/calc';

export default function Stock() {
  const db = useDb();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [onlyMoved, setOnlyMoved] = useState(false);
  const { baseline, rows } = stockRows(db);

  if (!baseline) {
    return (
      <Screen title="Остатки">
        <div className="empty">
          <span className="big">📦</span>
          Остатки считаются от завершённого пересчёта. Завершите первый пересчёт — и здесь появятся остатки
          с учётом списаний из журнала.
        </div>
      </Screen>
    );
  }

  const needle = q.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (cat === 'all' || r.product.categoryId === cat) &&
      (!onlyMoved || r.moved) &&
      r.product.name.toLowerCase().includes(needle),
  );
  const cats = [...baseline.categories].sort((a, b) => a.order - b.order);

  return (
    <Screen title="Остатки" sub={`от пересчёта ${fmtDateTime(baseline.finishedAt as string)}`}>
      <div className="card tight small muted">
        Остаток = итог пересчёта − списания, записанные в «Журнале» после него. Приходы и продажи не учитываются.
      </div>

      <input className="input" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row wrap">
        <select className="input grow" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">Все разделы</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
        <button className={`btn sm ${onlyMoved ? 'primary' : ''}`} onClick={() => setOnlyMoved((v) => !v)}>
          Только со списаниями
        </button>
      </div>

      {cats.map((c) => {
        const list = visible.filter((r) => r.product.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section className="card tight table-wrap" key={c.id} style={{ ['--cat']: `#${c.color}` } as CSSProperties}>
            <table className="grid">
              <thead>
                <tr>
                  <th><span className="dot" />{c.emoji} {c.name}</th>
                  <th>Пересчёт</th>
                  <th>Списания</th>
                  <th>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.product.id}>
                    <td>{r.product.name}</td>
                    <td>{fmtQty(r.base, r.product.unit)}</td>
                    <td>{r.writeoff ? fmtQty(r.writeoff, r.product.unit) : '—'}</td>
                    <td className={r.now < 0 ? 'danger strong' : 'strong'}>{fmtQty(r.now, r.product.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {visible.length === 0 && <div className="empty">Ничего не найдено.</div>}
    </Screen>
  );
}
