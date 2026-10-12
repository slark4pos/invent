import { useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { actions, useDb } from '../lib/store';
import { sessionWriteoffs } from '../lib/movements';
import {
  amountInUnit,
  categorySummaries,
  fmtAmount,
  fmtDateTime,
  fmtLiters,
  fmtMl,
  fmtNum,
  fmtTotals,
  productTotals,
  sessionProgress,
  sessionTotals,
  unitLabel,
} from '../lib/calc';
import { buildReport } from '../lib/excel';
import { downloadBlob, isNative, shareOrDownload } from '../lib/share';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { BAR_NAME } from '../config';
import { syncNow } from '../lib/sync';

export default function SessionView() {
  const { sessionId } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const session = db.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <Screen title="Пересчёт не найден" back="/">
        <div className="empty">Эта инвентаризация была удалена.</div>
      </Screen>
    );
  }

  const progress = sessionProgress(session);
  const writeoffs = sessionWriteoffs(db, session);
  const summaries = categorySummaries(session);
  const grand = sessionTotals(session);

  const makeAndShare = async () => {
    setBusy(true);
    try {
      const { blob, filename } = await buildReport(session, writeoffs);
      const res = await shareOrDownload(blob, filename, `Инвентаризация ${BAR_NAME} от ${fmtDateTime(session.createdAt)}`);
      toast.show(res === 'shared' ? 'Отчёт отправлен' : 'Файл скачан — отправьте его из «Загрузок»');
    } catch (e) {
      console.error(e);
      toast.show('Не удалось сформировать отчёт');
    } finally {
      setBusy(false);
    }
  };

  const justDownload = async () => {
    setBusy(true);
    try {
      const { blob, filename } = await buildReport(session, writeoffs);
      await downloadBlob(blob, filename);
      toast.show('Файл скачан');
    } catch (e) {
      console.error(e);
      toast.show('Не удалось сформировать отчёт');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (progress.counted < progress.total) {
      const ok = await confirm(
        `Посчитано ${progress.counted} из ${progress.total} позиций. Непосчитанные уйдут в отчёт с нулями. Завершить?`,
        { okLabel: 'Завершить', danger: false },
      );
      if (!ok) return;
    }
    actions.finishSession(session.id);
    toast.show('Пересчёт завершён');
    // Отправка на сервер: если связи нет, пересчёт уйдёт позже сам.
    void syncNow().then((r) => {
      if (r.error === 'not-configured') return;
      toast.show(r.ok ? 'Пересчёт отправлен на сервер' : `Сервер недоступен — отправится позже (${r.error})`);
    });
  };

  const remove = async () => {
    if (!(await confirm('Удалить этот пересчёт вместе с данными? Отменить будет нельзя.', { okLabel: 'Удалить' }))) return;
    actions.removeSession(session.id);
    navigate('/history');
  };

  return (
    <Screen
      title={session.status === 'draft' ? 'Итоги пересчёта' : 'Инвентаризация'}
      sub={fmtDateTime(session.createdAt)}
      back="/"
    >
      <section className="card col">
        <div className="row spread">
          <span className={`pill ${session.status === 'draft' ? 'on' : 'done'}`}>
            {session.status === 'draft' ? 'Черновик' : 'Завершена'}
          </span>
          <span className="tiny muted">
            {session.finishedAt ? `завершена ${fmtDateTime(session.finishedAt)}` : 'ещё можно править'}
          </span>
        </div>
        <div className="bar">
          <i style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
        <div className="totals">
          <span><span className="muted">Полных бут.: </span><span className="strong">{fmtNum(grand.full - grand.pcs)}</span></span>
          <span><span className="muted">Открытых: </span><span className="strong">{fmtNum(grand.openCount)}</span></span>
          <span><span className="muted">Остаток: </span><span className="strong">{fmtMl(grand.openMl)}</span></span>
          <span><span className="muted">Жидкость: </span><span className="strong accent">{fmtLiters(grand.ml)}</span></span>
          {grand.pcs > 0 && <span><span className="muted">Штучно: </span><span className="strong">{fmtNum(grand.pcs)} шт</span></span>}
          {grand.g > 0 && <span><span className="muted">Вес: </span><span className="strong">{fmtNum(grand.g)} г</span></span>}
        </div>
        <div className="small muted">
          Точки подсчёта: {session.locations.map((l) => l.name).join(', ')} · посчитано {progress.counted} из {progress.total}
        </div>
      </section>

      {session.status === 'draft' && (
        <>
          <div className="section-title">Продолжить ввод</div>
          <div className="cats">
            {[...session.categories]
              .sort((a, b) => a.order - b.order)
              .map((c) => {
                const list = session.products.filter((p) => p.categoryId === c.id);
                const counted = list.filter((p) => productTotals(session, p).counted).length;
                const done = list.length > 0 && counted === list.length;
                return (
                  <button
                    key={c.id}
                    className={`cat${done ? ' full' : ''}`}
                    style={{ ['--cat']: `#${c.color}` } as CSSProperties}
                    onClick={() => navigate(`/session/${session.id}/cat/${c.id}`)}
                  >
                    <span className="emoji">{c.emoji}</span>
                    <span className="name grow">{c.name}</span>
                    <span className="tiny muted">{counted}/{list.length}</span>
                  </button>
                );
              })}
          </div>
        </>
      )}

      <section className="card col">
        <label className="field">
          Кто считал
          <input
            className="input"
            value={session.author ?? ''}
            placeholder="Имя"
            disabled={session.status === 'finished'}
            onChange={(e) => actions.patchSession(session.id, { author: e.target.value })}
          />
        </label>
        <label className="field">
          Комментарий к пересчёту
          <textarea
            className="input"
            rows={2}
            value={session.note ?? ''}
            placeholder="Например: без склада, холодильник не считали"
            disabled={session.status === 'finished'}
            onChange={(e) => actions.patchSession(session.id, { note: e.target.value })}
          />
        </label>
      </section>

      <div className="section-title">Сводка по разделам</div>
      <section className="card tight table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Раздел</th>
              <th>Полных</th>
              <th>Открытых</th>
              <th>Остаток</th>
              <th>Всего</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.categoryId}>
                <td>
                  <span className="dot" style={{ ['--cat']: `#${s.color}` } as CSSProperties} />
                  {s.emoji} {s.name}
                </td>
                <td>{fmtNum(s.full - s.pcs)}</td>
                <td>{fmtNum(s.openCount)}</td>
                <td>{fmtMl(s.openMl)}</td>
                <td>{fmtTotals(s)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Итого</td>
              <td>{fmtNum(grand.full - grand.pcs)}</td>
              <td>{fmtNum(grand.openCount)}</td>
              <td>{fmtMl(grand.openMl)}</td>
              <td>{fmtTotals(grand)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <button className="btn block ghost" onClick={() => setShowDetails((v) => !v)}>
        {showDetails ? 'Скрыть подробности по позициям' : 'Показать все позиции'}
      </button>

      {showDetails && (
        <section className="card tight table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Обозначение</th>
                <th>Ед.</th>
                {session.locations.map((l) => (
                  <th key={l.id}>{l.name}</th>
                ))}
                <th>Остаток</th>
              </tr>
            </thead>
            <tbody>
              {[...session.categories]
                .sort((a, b) => a.order - b.order)
                .flatMap((c) => {
                  const list = session.products.filter((p) => p.categoryId === c.id);
                  if (list.length === 0) return [];
                  return [
                    <tr className="cat-row" key={c.id} style={{ ['--cat']: `#${c.color}` } as CSSProperties}>
                      <td colSpan={session.locations.length + 4}>{c.name.toUpperCase()}</td>
                    </tr>,
                    ...list.map((p) => {
                      const t = productTotals(session, p);
                      return (
                        <tr key={p.id} className={t.counted ? '' : 'uncounted'}>
                          <td>{p.name}</td>
                          <td>{p.tag}</td>
                          <td>{unitLabel(p.unit)}</td>
                          {session.locations.map((l) => (
                            <td key={l.id}>{fmtNum(amountInUnit(t.byLocation[l.id], p.unit))}</td>
                          ))}
                          <td>{fmtAmount(t, p.unit)}</td>
                        </tr>
                      );
                    }),
                  ];
                })}
            </tbody>
          </table>
        </section>
      )}

      <div className="section-title">Отчёт</div>
      <section className="card col">
        <button className="btn primary block" onClick={() => void makeAndShare()} disabled={busy}>
          {busy ? 'Готовим файл…' : '📤 Excel → поделиться (Telegram, почта)'}
        </button>
        {!isNative() && (
          <button className="btn block" onClick={() => void justDownload()} disabled={busy}>
            ⬇️ Просто скачать .xlsx
          </button>
        )}
        <div className="row spread small">
          <span className="muted">Списаний в отчёте: {writeoffs.items.length}</span>
          <button className="btn sm ghost" onClick={() => navigate('/journal')}>Журнал</button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          Откроется системное меню «Поделиться» — оттуда файл уходит в Telegram, на почту, в облако
          или сохраняется на устройство.
        </p>
      </section>

      <div className="row wrap">
        {session.status === 'draft' ? (
          <button className="btn grow" onClick={() => void finish()}>
            ✓ Завершить пересчёт
          </button>
        ) : (
          <button className="btn grow" onClick={() => actions.reopenSession(session.id)}>
            ✎ Открыть заново
          </button>
        )}
        <button className="btn ghost danger" onClick={() => void remove()}>
          Удалить
        </button>
      </div>
    </Screen>
  );
}
