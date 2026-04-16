import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchEvent, fetchRequests, createRequest, voteRequest, updateRequestStatus } from '../api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import SongAutocomplete from '../components/SongAutocomplete';
import { MicrophoneIcon, MusicalNoteIcon, FireIcon, CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon, ClockIcon, FunnelIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FireIcon as FireIconSolid } from '@heroicons/react/24/solid';

// Stable voter token per browser session
function getVoterToken() {
  let t = sessionStorage.getItem('voter_token');
  if (!t) {
    t = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    sessionStorage.setItem('voter_token', t);
  }
  return t;
}

const STATUS_OPTS = { pending: 'Pendiente', played: 'Tocada', rejected: 'Rechazada' };

export default function LiveRequestsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { isAuthenticated } = useAuth();
  const voterToken = useRef(getVoterToken());

  const [event, setEvent]       = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');
  const [voted, setVoted]       = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('voted') || '{}'); }
    catch { return {}; }
  });

  // Form
  const [form, setForm] = useState({ title: '', artist: '', requested_by: '' });
  const [submitting, setSubmitting] = useState(false);

  const saveVoted = (id) => {
    const next = { ...voted, [id]: true };
    setVoted(next);
    sessionStorage.setItem('voted', JSON.stringify(next));
  };

  const loadData = useCallback(async () => {
    try {
      const [ev, reqs] = await Promise.all([fetchEvent(eventId), fetchRequests(eventId)]);
      setEvent(ev);
      setRequests(reqs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time updates
  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;
    s.emit('join:event', eventId);

    const onNew     = (req) => setRequests(r => [req, ...r]);
    const onVoted   = (req) => setRequests(r => r.map(x => x.id === req.id ? req : x));
    const onStatus  = (req) => setRequests(r => r.map(x => x.id === req.id ? req : x));

    s.on('requests:new',            onNew);
    s.on('requests:vote_updated',   onVoted);
    s.on('requests:status_updated', onStatus);

    return () => {
      s.emit('leave:event', eventId);
      s.off('requests:new',            onNew);
      s.off('requests:vote_updated',   onVoted);
      s.off('requests:status_updated', onStatus);
    };
  }, [socket, eventId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await createRequest({
        event_id:     eventId,
        title:        form.title.trim(),
        artist:       form.artist.trim() || undefined,
        requested_by: form.requested_by.trim() || 'Anónimo',
      });
      setForm({ title: '', artist: '', requested_by: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id) => {
    if (voted[id]) return;
    try {
      await voteRequest(id, voterToken.current);
      saveVoted(id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatus = async (id, status) => {
    try { await updateRequestStatus(id, status); }
    catch (err) { alert(err.message); }
  };

  const sorted = [...requests]
    .filter(r => filter === 'all' || r.status === filter)
    .sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));

  if (loading) return <div className="loader">Cargando…</div>;

  return (
    <main className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} title="Volver">
            <ArrowLeftIcon className="icon-sm" />
          </button>
          <div>
            <h1><MicrophoneIcon className="icon-inline" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />Pedidos en Vivo</h1>
            {event && <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: 4 }}>{event.title}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: 'var(--muted)' }}>
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Tiempo real activo' : 'Sin conexión'}
        </div>
      </div>

      {/* Request form */}
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Pedir una canción</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Canción *</label>
              <SongAutocomplete
                value={form.title}
                onChange={val => setForm(f => ({ ...f, title: val }))}
                onSelect={suggestion => {
                  // Intenta separar "Artista - Canción" o "Canción - Artista"
                  const dashIdx = suggestion.indexOf(' - ');
                  if (dashIdx !== -1) {
                    const left  = suggestion.slice(0, dashIdx).trim();
                    const right = suggestion.slice(dashIdx + 3).trim();
                    // Heurística: el fragmento más corto suele ser el artista
                    const [artist, title] = left.length <= right.length
                      ? [left, right]
                      : [right, left];
                    setForm(f => ({ ...f, title, artist }));
                  } else {
                    setForm(f => ({ ...f, title: suggestion }));
                  }
                }}
                placeholder="Shape of You"
              />
            </div>
            <div className="form-group">
              <label>Artista</label>
              <input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="Ed Sheeran" />
            </div>
            <div className="form-group">
              <label>Tu nombre</label>
              <input value={form.requested_by} onChange={e => setForm(f => ({ ...f, requested_by: e.target.value }))} placeholder="Anónimo" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enviando…' : <><MusicalNoteIcon className="icon-sm" /> Pedir canción</>}
          </button>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {[['pending', 'Pendientes'], ['played', 'Tocadas'], ['rejected', 'Rechazadas'], ['all', 'Todas']].map(([val, label]) => (
          <button key={val} className={`tab-btn${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>
            {val === 'pending' && <ClockIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}
            {val === 'played' && <CheckCircleIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}
            {val === 'rejected' && <XCircleIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}
            {val === 'all' && <FunnelIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}
            {label}
          </button>
        ))}
      </div>

      {/* Ranking */}
      {sorted.length === 0 && (
        <div className="empty-state">
          <MicrophoneIcon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', color: 'var(--muted)' }} />
          No hay pedidos {filter !== 'all' ? 'en esta categoría' : 'todavía'}.
        </div>
      )}

      <ol className="rank-list">
        {sorted.map((req, idx) => (
          <li className="rank-item" key={req.id}>
            {filter === 'pending' || filter === 'all'
              ? <div className="rank-position">#{idx + 1}</div>
              : <div className="rank-position" style={{ fontSize: '1rem' }}>
                  <span className={`badge badge-${req.status}`}>{STATUS_OPTS[req.status]}</span>
                </div>
            }
            <div className="rank-info">
              <div className="rank-title">{req.title}</div>
              {req.artist && <div className="rank-artist">{req.artist}</div>}
              <div className="rank-requester">pedido por {req.requested_by}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <button
                className="vote-btn"
                onClick={() => handleVote(req.id)}
                disabled={voted[req.id] || req.status !== 'pending'}
                title={voted[req.id] ? 'Ya votaste' : 'Votar'}
              >
                <FireIconSolid className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />{req.votes}
              </button>
              {/* DJ controls */}
              {isAuthenticated && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {req.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => handleStatus(req.id, 'played')}><CheckCircleIcon className="icon-sm" /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleStatus(req.id, 'rejected')}><XCircleIcon className="icon-sm" /></button>
                    </>
                  )}
                  {req.status !== 'pending' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(req.id, 'pending')}><ArrowUturnLeftIcon className="icon-sm" /></button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
