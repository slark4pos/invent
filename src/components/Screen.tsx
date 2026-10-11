import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  title: string;
  sub?: string;
  back?: boolean | string;
  right?: ReactNode;
  children: ReactNode;
};

export default function Screen({ title, sub, back, right, children }: Props) {
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        {back && (
          <button
            className="iconbtn"
            aria-label="Назад"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          >
            ‹
          </button>
        )}
        <h1>
          {title}
          {sub && <span className="sub">{sub}</span>}
        </h1>
        {right}
      </header>
      <main className="content">{children}</main>
    </>
  );
}
