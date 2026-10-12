import { useState } from 'react';
import Screen from '../components/Screen';
import { actions, useDb } from '../lib/store';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import type { Unit } from '../types';

type Draft = { name: string; tag: string; unit: Unit; vol: string };

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'ml', label: 'Бутылки + мл' },
  { value: 'pcs', label: 'Штуки' },
  { value: 'g', label: 'Граммы' },
];

export default function Catalog() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'products' | 'categories' | 'locations'>('products');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🍶');
  const [newLoc, setNewLoc] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const draftFor = (catId: string): Draft => {
    const fallbackTag = db.products.find((p) => p.categoryId === catId)?.tag ?? '';
    return drafts[catId] ?? { name: '', tag: fallbackTag, unit: 'ml', vol: '700' };
  };

  const setDraft = (catId: string, patch: Partial<Draft>) =>
    setDrafts({ ...drafts, [catId]: { ...draftFor(catId), ...patch } });

  const addProduct = (catId: string) => {
    const d = draftFor(catId);
    const name = d.name.trim();
    if (!name) return;
    const vol = d.unit === 'ml' ? Math.max(1, Number(d.vol.replace(',', '.')) || 0) : 0;
    actions.addProduct(catId, name, d.tag, d.unit, vol);
    setDraft(catId, { name: '' });
    toast.show('Позиция добавлена');
  };

  return (
    <Screen title="Справочник" sub={`${db.products.length} позиций в ${db.categories.length} разделах`}>
      <div className="row">
        <button className={`btn sm grow ${tab === 'products' ? 'primary' : ''}`} onClick={() => setTab('products')}>Позиции</button>
        <button className={`btn sm grow ${tab === 'categories' ? 'primary' : ''}`} onClick={() => setTab('categories')}>Разделы</button>
        <button className={`btn sm grow ${tab === 'locations' ? 'primary' : ''}`} onClick={() => setTab('locations')}>Точки</button>
      </div>

      <p className="tiny muted" style={{ margin: 0 }}>
        Изменения попадут в следующий пересчёт. Уже созданные пересчёты хранят свой снимок справочника и не меняются.
      </p>

      {tab === 'products' &&
        [...db.categories]
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const list = db.products.filter((p) => p.categoryId === c.id);
            const isOpen = openCat === c.id;
            const d = draftFor(c.id);
            return (
              <section className="card col" key={c.id}>
                <div className="row spread" style={{ cursor: 'pointer' }} onClick={() => setOpenCat(isOpen ? null : c.id)}>
                  <span className="strong">{c.emoji} {c.name}</span>
                  <span className="pill">{list.length}</span>
                  <span className="muted" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                </div>

                {isOpen && (
                  <>
                    {list.map((p) => (
                      <div className="col" style={{ gap: 6 }} key={p.id}>
                        <div className="row">
                          <input
                            className="input grow"
                            value={p.name}
                            onChange={(e) => actions.updateProduct(p.id, { name: e.target.value })}
                          />
                          <button
                            className="btn sm ghost danger"
                            onClick={async () => {
                              if (await confirm(`Удалить позицию «${p.name}» из справочника?`, { okLabel: 'Удалить' })) actions.removeProduct(p.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div className="row">
                          <input
                            className="input grow"
                            value={p.tag}
                            aria-label="Обозначение товара"
                            placeholder="Обозначение"
                            onChange={(e) => actions.updateProduct(p.id, { tag: e.target.value })}
                          />
                          <select
                            className="input"
                            style={{ width: 128 }}
                            value={p.unit}
                            aria-label="Единица подсчёта"
                            onChange={(e) => actions.updateProduct(p.id, { unit: e.target.value as Unit })}
                          >
                            {UNIT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {p.unit === 'ml' && (
                            <input
                              className="input"
                              style={{ width: 84 }}
                              inputMode="numeric"
                              value={p.volumeMl}
                              aria-label="Объём бутылки, мл"
                              onChange={(e) => actions.updateProduct(p.id, { volumeMl: Math.max(1, Number(e.target.value) || 0) })}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {list.length === 0 && <span className="small muted">Позиций пока нет.</span>}

                    <div className="col" style={{ gap: 6, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
                      <div className="row">
                        <input
                          className="input grow"
                          placeholder="Новая позиция"
                          value={d.name}
                          onChange={(e) => setDraft(c.id, { name: e.target.value })}
                        />
                        <button className="btn sm primary" onClick={() => addProduct(c.id)}>+</button>
                      </div>
                      <div className="row">
                        <input
                          className="input grow"
                          placeholder="Обозначение"
                          value={d.tag}
                          aria-label="Обозначение новой позиции"
                          onChange={(e) => setDraft(c.id, { tag: e.target.value })}
                        />
                        <select
                          className="input"
                          style={{ width: 128 }}
                          value={d.unit}
                          aria-label="Единица подсчёта новой позиции"
                          onChange={(e) => setDraft(c.id, { unit: e.target.value as Unit })}
                        >
                          {UNIT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {d.unit === 'ml' && (
                          <input
                            className="input"
                            style={{ width: 84 }}
                            inputMode="numeric"
                            value={d.vol}
                            aria-label="Объём бутылки новой позиции, мл"
                            onChange={(e) => setDraft(c.id, { vol: e.target.value })}
                          />
                        )}
                      </div>
                      <span className="tiny muted">
                        Последнее поле — объём бутылки в мл (700 = 0,7 л). Для штучного и весового товара он не нужен.
                      </span>
                    </div>
                  </>
                )}
              </section>
            );
          })}

      {tab === 'categories' && (
        <>
          {[...db.categories]
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <div className="card tight row" key={c.id}>
                <input
                  className="input"
                  style={{ width: 58, textAlign: 'center' }}
                  value={c.emoji}
                  aria-label="Иконка"
                  onChange={(e) => actions.updateCategory(c.id, { emoji: e.target.value })}
                />
                <input
                  className="input grow"
                  value={c.name}
                  onChange={(e) => actions.updateCategory(c.id, { name: e.target.value })}
                />
                <button
                  className="btn sm ghost danger"
                  onClick={async () => {
                    const n = db.products.filter((p) => p.categoryId === c.id).length;
                    if (await confirm(`Удалить раздел «${c.name}» и ${n} позиций в нём?`, { okLabel: 'Удалить' })) actions.removeCategory(c.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          <div className="card tight row">
            <input
              className="input"
              style={{ width: 58, textAlign: 'center' }}
              value={newCatEmoji}
              aria-label="Иконка нового раздела"
              onChange={(e) => setNewCatEmoji(e.target.value)}
            />
            <input
              className="input grow"
              placeholder="Новый раздел"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <button
              className="btn sm primary"
              onClick={() => {
                if (!newCatName.trim()) return;
                actions.addCategory(newCatName, newCatEmoji);
                setNewCatName('');
                toast.show('Раздел добавлен');
              }}
            >
              +
            </button>
          </div>
        </>
      )}

      {tab === 'locations' && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Точки подсчёта — это места, где лежит товар: склад, бар, второй бар. В пересчёте для каждой позиции
            будет отдельное поле на каждую точку, а в отчёте — колонка на точку плюс «Остаток» итого.
            Порядок колонок в отчёте совпадает с порядком здесь.
          </p>
          {db.locations.map((l) => (
            <div className="card tight row" key={l.id}>
              <input className="input grow" value={l.name} onChange={(e) => actions.updateLocation(l.id, e.target.value)} />
              <button
                className="btn sm ghost danger"
                disabled={db.locations.length <= 1}
                onClick={async () => {
                  if (await confirm(`Убрать точку «${l.name}»?`, { okLabel: 'Убрать' })) actions.removeLocation(l.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="card tight row">
            <input
              className="input grow"
              placeholder="Новая точка (например «Холодильник»)"
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
            />
            <button
              className="btn sm primary"
              onClick={() => {
                if (!newLoc.trim()) return;
                actions.addLocation(newLoc);
                setNewLoc('');
                toast.show('Точка добавлена');
              }}
            >
              +
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}
