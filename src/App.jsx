import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/layout/ProtectedRoute';
import FixturePage from './pages/FixturePage';
import StandingsPage from './pages/StandingsPage';
import StatsPage from './pages/StatsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import MatchDetailPage from './pages/MatchDetailPage';
import PlayerPhotoUpload from './pages/PlayerPhotoUpload';
import GalleryPage from './pages/GalleryPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMatchPage from './pages/AdminMatchPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Navbar />
            <Routes>
              <Route path="/" element={<FixturePage />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/match/:matchId" element={<MatchDetailPage />} />
              <Route path="/jugador/foto/:token" element={<PlayerPhotoUpload />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/match/:matchId" element={<ProtectedRoute><AdminMatchPage /></ProtectedRoute>} />
            </Routes>
          </div>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
