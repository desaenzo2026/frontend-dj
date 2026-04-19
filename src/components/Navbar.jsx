import { NavLink, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

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
      <span className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>🎧 DJ App</span>
      {isAuthenticated && (
        <>
          <NavLink to="/" end>📅 <span>Agenda</span></NavLink>
        </>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: '#888' }}>
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'En vivo' : 'Desconectado'}
        </div>
        {isAuthenticated && (
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            🚪 Salir
          </button>
        )}
      </div>
    </nav>
  );
}
