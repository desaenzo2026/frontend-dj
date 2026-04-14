import { Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import AgendaPage from './pages/AgendaPage';
import PartyPage from './pages/PartyPage';
import LiveRequestsPage from './pages/LiveRequestsPage';
import SharedListPage from './pages/SharedListPage';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="app-layout">
          <Navbar />
          <Routes>
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/"                element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
            <Route path="/party/:eventId"  element={<ProtectedRoute><PartyPage /></ProtectedRoute>} />
            <Route path="/live/:eventId"   element={<LiveRequestsPage />} />
            <Route path="/share/:token"    element={<SharedListPage />} />
          </Routes>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}
