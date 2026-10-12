import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', ic: '🏠', label: 'Главная' },
  { to: '/journal', ic: '📝', label: 'Журнал' },
  { to: '/stock', ic: '📦', label: 'Остатки' },
  { to: '/history', ic: '🗂', label: 'История' },
  { to: '/catalog', ic: '📋', label: 'Справочник' },
  { to: '/settings', ic: '⚙️', label: 'Настройки' },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ic">{t.ic}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
