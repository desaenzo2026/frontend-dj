import { NavLink, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { CalendarDaysIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';

export default function Navbar() {
  const { connected } = useSocket();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="navbar">
      <span className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}><img src="/logo.jpg" alt="Anich Sistemas" className="navbar-logo" /> Anich Sistemas</span>
      {isAuthenticated && (
        <>
          <NavLink to="/" end><CalendarDaysIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} /> <span>Agenda</span></NavLink>
        </>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: 'var(--muted)' }}>
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'En vivo' : 'Desconectado'}
        </div>
        {isAuthenticated && (
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <ArrowRightStartOnRectangleIcon className="icon-sm" /> Salir
          </button>
        )}
      </div>
    </nav>
  );
}
