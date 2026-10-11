import { useState } from 'react';
import type { Cell, LocationDef, Product, Session } from '../types';
import { cellTotals, emptyCell, fmtAmount, fmtLiters, fmtMl, fmtNum, productTotals } from '../lib/calc';
import NumInput from './NumInput';

type Props = {
  product: Product;
  session: Session;
  onCell: (locationId: string, cell: Cell) => void;
  onClear: () => void;
};

const FRACTIONS = [0.25, 0.5, 0.75];

export default function ProductCard({ product, session, onCell, onClear }: Props) {
  const row = session.entries[product.id];
  const totals = productTotals(session, product);
  const [open, setOpen] = useState(false);
  const locked = session.status === 'finished';

  const cellOf = (locId: string): Cell => row?.[locId] ?? emptyCell();

  const setFull = (loc: LocationDef, full: number) => onCell(loc.id, { ...cellOf(loc.id), full: Math.round(full) });
  const setGrams = (loc: LocationDef, grams: number) => onCell(loc.id, { ...cellOf(loc.id), grams });

  const setOpenAt = (loc: LocationDef, i: number, ml: number) => {
    const cell = cellOf(loc.id);
    const nextOpen = [...cell.open];
    nextOpen[i] = ml;
    onCell(loc.id, { ...cell, open: nextOpen });
  };

  const addOpen = (loc: LocationDef) => {
    const cell = cellOf(loc.id);
    onCell(loc.id, { ...cell, open: [...cell.open, 0] });
  };

  const removeOpen = (loc: LocationDef, i: number) => {
    const cell = cellOf(loc.id);
    onCell(loc.id, { ...cell, open: cell.open.filter((_, idx) => idx !== i) });
  };

  const markZero = () => {
    for (const loc of session.locations) onCell(loc.id, emptyCell());
  };

  const subtitle = () => {
    if (!totals.counted) {
      if (product.unit === 'ml') return `бутылка ${fmtNum(product.volumeMl)} мл · не посчитано`;
      return product.unit === 'pcs' ? 'штучно · не посчитано' : 'вес в граммах · не посчитано';
    }
    if (product.unit === 'ml') return `${fmtNum(totals.full)} бут. + ${fmtMl(totals.openMl)} = ${fmtLiters(totals.ml)}`;
    return fmtAmount(totals, product.unit);
  };

  return (
    <article className={`card product${totals.counted ? ' counted' : ''}`}>
      <div className="row spread" onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        <div className="grow">
          <div className="strong">{product.name}</div>
          <div className="small muted">{subtitle()}</div>
        </div>
        <span className={`pill${totals.counted ? ' done' : ''}`}>{totals.counted ? '✓' : '—'}</span>
        <span className="muted" aria-hidden>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <>
          {session.locations.map((loc) => {
            const cell = cellOf(loc.id);
            const t = cellTotals(cell, product);
            return (
              <div className="loc-block" key={loc.id}>
                <div className="row spread">
                  <span className="loc-name">{loc.name}</span>
                  <span className="tiny muted">
                    {product.unit === 'ml'
                      ? `${fmtNum(t.bottleEq, 2)} бут. · ${fmtLiters(t.ml)}`
                      : fmtAmount(t, product.unit)}
                  </span>
                </div>

                {product.unit === 'g' ? (
                  <div className="row wrap">
                    <span className="small muted" style={{ minWidth: 92 }}>Вес, г</span>
                    <NumInput
                      value={cell.grams ?? 0}
                      onChange={(n) => setGrams(loc, n)}
                      ariaLabel={`Вес в граммах, ${loc.name}`}
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <div className="row wrap">
                    <span className="small muted" style={{ minWidth: 92 }}>
                      {product.unit === 'ml' ? 'Полных, шт' : 'Количество, шт'}
                    </span>
                    <div className="stepper">
                      <button type="button" disabled={locked} onClick={() => setFull(loc, Math.max(0, cell.full - 1))} aria-label="Минус">−</button>
                      <NumInput className="qty" value={cell.full} onChange={(n) => setFull(loc, n)} ariaLabel={`Количество, ${loc.name}`} />
                      <button type="button" disabled={locked} onClick={() => setFull(loc, cell.full + 1)} aria-label="Плюс">+</button>
                    </div>
                  </div>
                )}

                {product.unit === 'ml' && (
                  <div className="opens">
                    <span className="small muted">Открытые — остаток в мл</span>
                    {cell.open.length === 0 && <span className="tiny muted">открытых нет</span>}
                    {cell.open.map((ml, i) => (
                      <div key={i}>
                        <div className="open-row">
                          <span className="idx">#{i + 1}</span>
                          <NumInput
                            value={ml}
                            max={product.volumeMl}
                            onChange={(n) => setOpenAt(loc, i, n)}
                            placeholder={`до ${product.volumeMl}`}
                            ariaLabel={`Остаток открытой №${i + 1}, ${loc.name}`}
                          />
                          <button type="button" className="rm" disabled={locked} onClick={() => removeOpen(loc, i)} aria-label="Убрать открытую">
                            ×
                          </button>
                        </div>
                        <div className="row wrap" style={{ gap: 6, marginTop: 5, marginLeft: 27 }}>
                          {FRACTIONS.map((f) => (
                            <button
                              key={f}
                              type="button"
                              className="btn sm ghost"
                              disabled={locked}
                              onClick={() => setOpenAt(loc, i, Math.round(product.volumeMl * f))}
                            >
                              {f === 0.25 ? '¼' : f === 0.5 ? '½' : '¾'}
                            </button>
                          ))}
                          <button type="button" className="btn sm ghost" disabled={locked} onClick={() => setOpenAt(loc, i, product.volumeMl)}>
                            полная
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="btn sm" disabled={locked} onClick={() => addOpen(loc)}>
                      + открытая бутылка
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="totals">
            {product.unit === 'ml' ? (
              <>
                <span><span className="muted">Полных: </span><span className="strong">{fmtNum(totals.full)}</span></span>
                <span><span className="muted">Открытых: </span><span className="strong">{fmtNum(totals.openCount)}</span></span>
                <span><span className="muted">Остаток: </span><span className="strong">{fmtMl(totals.openMl)}</span></span>
                <span><span className="muted">Всего: </span><span className="strong accent">{fmtLiters(totals.ml)}</span></span>
                <span><span className="muted">Экв. бутылок: </span><span className="strong">{fmtNum(totals.bottleEq, 2)}</span></span>
              </>
            ) : (
              <span><span className="muted">Всего: </span><span className="strong accent">{fmtAmount(totals, product.unit)}</span></span>
            )}
          </div>

          {!locked && (
            <div className="row wrap">
              <button type="button" className="btn sm" onClick={markZero}>
                Нет в наличии (0)
              </button>
              {totals.counted && (
                <button type="button" className="btn sm ghost danger" onClick={onClear}>
                  Сбросить позицию
                </button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
