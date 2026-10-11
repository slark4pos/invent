import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { actions, useDb } from '../lib/store';
import { categoryProgress, fmtDateTime, fmtTotals, sessionProgress, sessionTotals } from '../lib/calc';
import { useToast } from '../components/Toast';
import { BAR_NAME } from '../config';

export default function Home() {
  const db = useDb();
  const navigate = useNavigate();
  const toast = useToast();

  const draft = db.sessions.find((s) => s.status === 'draft');
  const lastFinished = db.sessions.find((s) => s.status === 'finished');

  const openCategory = (categoryId: string) => {
    if (draft) {
      navigate(`/session/${draft.id}/cat/${categoryId}`);
      return;
    }
    const id = actions.startSession();
    toast.show('Начат новый пересчёт');
    navigate(`/session/${id}/cat/${categoryId}`);
  };

  const startNew = () => {
    const id = actions.startSession();
    toast.show('Начат новый пересчёт');
    navigate(`/session/${id}`);
  };

  const progress = draft ? sessionProgress(draft) : null;
  const totals = draft ? sessionTotals(draft) : null;

  return (
    <Screen title={BAR_NAME} sub="Инвентаризация">
      {draft && progress ? (
        <section className="card hero">
          <div className="row spread">
            <span className="pill on">Пересчёт идёт</span>
            <span className="tiny muted">{fmtDateTime(draft.createdAt)}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          <div className="row spread small">
            <span className="muted">
              Посчитано {progress.counted} из {progress.total}
            </span>
            <span className="strong accent">{totals ? fmtTotals(totals) : "0"}</span>
          </div>
          <div className="row">
            <button className="btn primary grow" onClick={() => navigate(`/session/${draft.id}`)}>
              Итоги и отправка
            </button>
          </div>
        </section>
      ) : (
        <section className="card hero">
          <h2>Готов к пересчёту</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {lastFinished
              ? `Последняя инвентаризация: ${fmtDateTime(lastFinished.finishedAt ?? lastFinished.createdAt)}`
              : 'Ещё ни одной инвентаризации не было. Начните первую — данные останутся на устройстве.'}
          </p>
          <button className="btn primary block" onClick={startNew}>
            Начать новый пересчёт
          </button>
        </section>
      )}

      <div className="section-title">Разделы</div>
      <div className="cats">
        {[...db.categories]
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const count = db.products.filter((p) => p.categoryId === c.id && !p.archived).length;
            const pr = draft ? categoryProgress(draft, c.id) : null;
            const done = pr && pr.total > 0 && pr.counted === pr.total;
            return (
              <button
                key={c.id}
                className={`cat${done ? ' full' : ''}`}
                style={{ ['--cat' as string]: `#${c.color}` } as CSSProperties}
                onClick={() => openCategory(c.id)}
              >
                <span className="emoji">{c.emoji}</span>
                <span className="name grow">{c.name}</span>
                {pr && pr.total > 0 ? (
                  <>
                    <div className="bar">
                      <i style={{ width: `${Math.round(pr.ratio * 100)}%` }} />
                    </div>
                    <span className="tiny muted">
                      {pr.counted}/{pr.total} посчитано
                    </span>
                  </>
                ) : (
                  <span className="tiny muted">{count} позиций</span>
                )}
              </button>
            );
          })}
      </div>

      {db.categories.length === 0 && (
        <div className="empty">
          <span className="big">🍸</span>
          Разделов пока нет. Добавьте их в «Справочнике».
        </div>
      )}
    </Screen>
  );
}
