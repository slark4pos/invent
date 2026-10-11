import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import { actions, useDb } from '../lib/store';
import { addTotals, categoryProgress, fmtTotals, productTotals } from '../lib/calc';
import type { Totals } from '../lib/calc';
import type { Unit } from '../types';
import { useToast } from '../components/Toast';

export default function CategoryCount() {
  const { sessionId, categoryId } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVol, setNewVol] = useState('700');
  const [newUnit, setNewUnit] = useState<Unit>('ml');
  const [newTag, setNewTag] = useState('');
  const railRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Держим текущий раздел на виду в боковой ленте, не трогая прокрутку страницы.
  useEffect(() => {
    const box = railRef.current;
    const el = activeRef.current;
    if (!box || !el) return;
    box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
  }, [categoryId]);

  const session = db.sessions.find((s) => s.id === sessionId);
  const category = session?.categories.find((c) => c.id === categoryId);

  if (!session || !category) {
    return (
      <Screen title="Раздел не найден" back="/">
        <div className="empty">Этот пересчёт или раздел больше не существует.</div>
      </Screen>
    );
  }

  const ordered = [...session.categories].sort((a, b) => a.order - b.order);
  const idx = ordered.findIndex((c) => c.id === category.id);
  const nextCat = ordered[idx + 1];

  const needle = query.trim().toLowerCase();
  const products = session.products
    .filter((p) => p.categoryId === category.id)
    .filter((p) => p.name.toLowerCase().includes(needle));

  const pr = categoryProgress(session, category.id);
  const zero: Totals = { full: 0, openCount: 0, openMl: 0, ml: 0, pcs: 0, g: 0, bottleEq: 0 };
  const catTotals = session.products
    .filter((p) => p.categoryId === category.id)
    .reduce((a, p) => addTotals(a, productTotals(session, p)), zero);

  /** Обозначение по умолчанию берём у соседей по разделу — как в исходном файле. */
  const defaultTag = session.products.find((p) => p.categoryId === category.id)?.tag ?? category.name;

  const addProduct = () => {
    const name = newName.trim();
    if (!name) return;
    const volumeMl = newUnit === 'ml' ? Math.max(1, Number(newVol.replace(',', '.')) || 0) : 0;
    const tag = newTag.trim() || defaultTag;
    // Пишем и в справочник (на будущее), и в снимок текущего пересчёта.
    const product = actions.addProduct(category.id, name, tag, newUnit, volumeMl);
    actions.patchSession(session.id, { products: [...session.products, product] });
    setNewName('');
    setNewTag('');
    setAdding(false);
    toast.show('Позиция добавлена');
  };

  return (
    <Screen title={`${category.emoji} ${category.name}`} sub={`${pr.counted} из ${pr.total} · ${fmtTotals(catTotals)}`} back="/">
      <div className="rail-layout">
        <nav className="rail" ref={railRef} aria-label="Разделы">
          {ordered.map((c) => {
            const p = categoryProgress(session, c.id);
            const active = c.id === category.id;
            const done = p.total > 0 && p.counted === p.total;
            return (
              <button
                key={c.id}
                ref={active ? activeRef : undefined}
                type="button"
                title={c.name}
                aria-current={active ? 'page' : undefined}
                className={`rail-item${active ? ' active' : ''}${done ? ' done' : ''}`}
                style={{ ['--cat']: `#${c.color}` } as CSSProperties}
                onClick={() => navigate(`/session/${session.id}/cat/${c.id}`)}
              >
                <span className="ri-emoji">{c.emoji}</span>
                <span className="ri-name">{c.name}</span>
                <span className="ri-count">{p.counted}/{p.total}</span>
              </button>
            );
          })}
        </nav>

        <div className="rail-main">
      {session.status === 'finished' && (
        <div className="card tight small muted">
          Пересчёт завершён — поля только для чтения. Открыть заново можно на экране итогов.
        </div>
      )}

      <input
        className="input"
        placeholder="Поиск по разделу"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="bar">
        <i style={{ width: `${Math.round(pr.ratio * 100)}%` }} />
      </div>

      <div className="products">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            session={session}
            onCell={(locId, cell) => actions.setCell(session.id, p.id, locId, cell)}
            onClear={() => actions.clearProduct(session.id, p.id)}
          />
        ))}
        {products.length === 0 && <div className="empty">В этом разделе нет позиций{query ? ' по запросу' : ''}.</div>}
      </div>

      {session.status === 'draft' && (
        adding ? (
          <div className="card col">
            <label className="field">
              Название позиции
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </label>
            <label className="field">
              Обозначение товара (колонка в отчёте)
              <input
                className="input"
                placeholder={defaultTag}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
              />
            </label>
            <label className="field">
              Как считаем
              <select className="input" value={newUnit} onChange={(e) => setNewUnit(e.target.value as Unit)}>
                <option value="ml">Бутылки + остаток в мл</option>
                <option value="pcs">Штуками</option>
                <option value="g">Весом, в граммах</option>
              </select>
            </label>
            {newUnit === 'ml' && (
              <label className="field">
                Объём бутылки, мл
                <input className="input" inputMode="numeric" value={newVol} onChange={(e) => setNewVol(e.target.value)} />
              </label>
            )}
            <div className="row">
              <button className="btn primary grow" onClick={addProduct}>Добавить</button>
              <button className="btn ghost" onClick={() => setAdding(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <button className="btn block" onClick={() => setAdding(true)}>+ Добавить позицию в раздел</button>
        )
      )}

      <div className="row">
        {nextCat ? (
          <button className="btn grow" onClick={() => navigate(`/session/${session.id}/cat/${nextCat.id}`)}>
            Дальше: {nextCat.emoji} {nextCat.name}
          </button>
        ) : (
          <span className="grow" />
        )}
        <button className="btn primary" onClick={() => navigate(`/session/${session.id}`)}>
          К итогам
        </button>
      </div>
        </div>
      </div>
    </Screen>
  );
}
