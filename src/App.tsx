import { Navigate, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import CategoryCount from './pages/CategoryCount';
import SessionView from './pages/SessionView';
import History from './pages/History';
import Catalog from './pages/Catalog';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ToastProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:sessionId" element={<SessionView />} />
          <Route path="/session/:sessionId/cat/:categoryId" element={<CategoryCount />} />
          <Route path="/history" element={<History />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </div>
    </ToastProvider>
  );
}
