import { useState } from 'react';
import Screen from '../components/Screen';
import NumInput from '../components/NumInput';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { actions, useDb } from '../lib/store';
import { fmtQty } from '../lib/calc';
import { WRITEOFF_SECTIONS } from '../config';
import type { Product, Unit } from '../types';

export default function Journal() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string>(WRITEOFF_SECTIONS[0]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Product | null>(null);
  const [freeUnit, setFreeUnit] = useState<Unit>('pcs');
  const [bottles, setBottles] = useState(false);
  const [qty, setQty] = useState(0);
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');

  const needle = query.trim().toLowerCase();
  const suggestions =
    !picked && needle ? db.products.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 6) : [];
  const names = [...new Set(db.movements.map((m) => m.who).filter(Boolean))] as string[];
  const bottleMode = Boolean(picked && picked.unit === 'ml' && bottles);

  const pick = (p: Product | null) => {
    setPicked(p);
    setQuery(p ? p.name : '');
    setBottles(false);
  };

  const save = () => {
    const name = (picked?.name ?? query).trim();
    if (!name || qty <= 0) {
      toast.show('Укажите позицию и количество');
      return;
    }
    const unit: Unit = picked ? picked.unit : freeUnit;
    actions.addMovement({
      kind: 'writeoff',
      section,
      productId: picked?.id,
      name,
      qty: bottleMode && picked ? qty * picked.volumeMl : qty,
      unit,
      who: who.trim() || undefined,
      note: note.trim() || undefined,
    });
    // Раздел и «кто» оставляем — чтобы быстро вносить подряд несколько позиций.
    pick(null);
    setQty(0);
    setNote('');
    toast.show('Записано');
  };

  const list = db.movements
    .filter((m) => filter === 'all' || m.section === filter)
    .sort((a, b) => b.at.localeCompare(a.at));

  let lastDay = '';

  return (
    <Screen title="Журнал" sub="Списания: кто, что и сколько взял">
      <div className="row wrap" style={{ gap: 6 }}>
        {['all', ...WRITEOFF_SECTIONS].map((k) => (
          <button key={k} className={`btn sm ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>
            {k === 'all' ? 'Все' : k}
          </button>
        ))}
      </div>

      {open ? (
        <section className="card col">
          <div className="row wrap" style={{ gap: 6 }}>
            {WRITEOFF_SECTIONS.map((s) => (
              <button key={s} className={`btn sm ${section === s ? 'primary' : ''}`} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </div>

          <label className="field">
            Что
            <input
              className="input"
              placeholder="Начните вводить название"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
              }}
            />
          </label>
          {suggestions.length > 0 && (
            <div className="suggest">
              {suggestions.map((p) => (
                <button key={p.id} type="button" onClick={() => pick(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="row wrap">
            <div className="grow" style={{ minWidth: 120 }}>
              <label className="field">
                Сколько{' '}
                {picked
                  ? picked.unit === 'ml'
                    ? bottleMode ? '(бутылок)' : '(мл)'
                    : picked.unit === 'pcs' ? '(шт)' : '(г)'
                  : ''}
                <NumInput value={qty} onChange={setQty} placeholder="0" ariaLabel="Количество" />
              </label>
            </div>
            {picked && picked.unit === 'ml' && (
              <button className="btn sm" onClick={() => setBottles((v) => !v)}>
                {bottleMode ? 'в бутылках' : 'в мл'} ⇄
              </button>
            )}
            {!picked && query.trim() && (
              <select className="input" style={{ width: 110 }} value={freeUnit} onChange={(e) => setFreeUnit(e.target.value as Unit)}>
                <option value="pcs">шт</option>
                <option value="ml">мл</option>
                <option value="g">г</option>
              </select>
            )}
          </div>
          {!picked && query.trim() && <span className="tiny muted">Этой позиции нет в справочнике — запишется как своя, без влияния на остатки.</span>}

          <label className="field">
            Кто взял
            <input className="input" list="who-names" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Имя" />
          </label>
          <datalist id="who-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <label className="field">
            Комментарий
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: разбили бокал" />
          </label>

          <div className="row">
            <button className="btn primary grow" onClick={save}>Записать</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Закрыть</button>
          </div>
        </section>
      ) : (
        <button className="btn primary block" onClick={() => setOpen(true)}>+ Новая запись</button>
      )}

      {list.length === 0 && (
        <div className="empty">
          <span className="big">📝</span>
          Записей пока нет. Здесь фиксируется, кто и что взял: кухня, персонал, комплимент, Амина, порча.
        </div>
      )}

      <div className="list">
        {list.map((m) => {
          const day = new Date(m.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
          const header = day !== lastDay ? day : null;
          lastDay = day;
          return (
            <div key={m.id}>
              {header && <div className="section-title" style={{ margin: '6px 2px' }}>{header}</div>}
              <div className="card tight row">
                <div className="grow">
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="pill on">{m.section ?? 'Списание'}</span>
                    <span className="strong">{m.name}</span>
                  </div>
                  <div className="small muted">
                    −{fmtQty(m.qty, m.unit)}
                    {m.who ? ` · ${m.who}` : ''}
                    {' · '}{new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {m.note ? ` · ${m.note}` : ''}
                  </div>
                </div>
                <button
                  className="btn sm ghost danger"
                  aria-label="Удалить запись"
                  onClick={async () => {
                    if (await confirm(`Удалить запись «${m.name}»?`, { okLabel: 'Удалить' })) actions.removeMovement(m.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
