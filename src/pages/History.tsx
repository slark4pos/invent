import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { useDb } from '../lib/store';
import { sessionWriteoffs } from '../lib/movements';
import { fmtDateTime, fmtTotals, sessionProgress, sessionTotals } from '../lib/calc';
import { buildReport } from '../lib/excel';
import { shareOrDownload } from '../lib/share';
import { useToast } from '../components/Toast';
import type { Session } from '../types';

export default function History() {
  const db = useDb();
  const navigate = useNavigate();
  const toast = useToast();

  const sessions = [...db.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const share = async (s: Session) => {
    try {
      const { blob, filename } = await buildReport(s, sessionWriteoffs(db, s));
      const res = await shareOrDownload(blob, filename);
      toast.show(res === 'shared' ? 'Отчёт отправлен' : 'Файл скачан');
    } catch (e) {
      console.error(e);
      toast.show('Не удалось сформировать отчёт');
    }
  };

  return (
    <Screen title="Прошлые инвентаризации" sub={`${sessions.length} записей`}>
      {sessions.length === 0 && (
        <div className="empty">
          <span className="big">🗂</span>
          Здесь появятся все пересчёты — с датой, временем и полными данными.
        </div>
      )}

      <div className="list">
        {sessions.map((s) => {
          const pr = sessionProgress(s);
          const totals = sessionTotals(s);
          return (
            <div className="hist" key={s.id}>
              <button
                onClick={() => navigate(`/session/${s.id}`)}
                className="grow"
                style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
              >
                <div className="row spread">
                  <span className="strong">{fmtDateTime(s.createdAt)}</span>
                  <span className={`pill ${s.status === 'draft' ? 'on' : 'done'}`}>
                    {s.status === 'draft' ? 'черновик' : 'завершена'}
                  </span>
                </div>
                <div className="small muted">
                  {fmtTotals(totals)} · позиций {pr.counted}/{pr.total}
                  {s.author ? ` · ${s.author}` : ''}
                </div>
                {s.note && <div className="tiny muted">{s.note}</div>}
              </button>
              <button className="btn sm" onClick={() => void share(s)} aria-label="Отправить отчёт">
                📤
              </button>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
