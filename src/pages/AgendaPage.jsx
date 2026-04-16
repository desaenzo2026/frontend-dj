import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents, createEvent, updateEvent, deleteEvent } from '../api';
import EventForm from '../components/Agenda/EventForm';

const STATUS_LABELS = {
  upcoming:  'Próximo',
  active:    'Activo',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

export default function AgendaPage() {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      setEvents(await fetchEvents());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await updateEvent(editing.id, data);
      } else {
        await createEvent(data);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      await deleteEvent(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const openEdit = (ev) => { setEditing(ev); setShowForm(true); };

  return (
    <main className="page">
      <div className="page-header">
        <h1>📅 Agenda de Eventos</h1>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          + Nuevo Evento
        </button>
      </div>

      {loading && <div className="loader">Cargando eventos…</div>}

      {!loading && events.length === 0 && (
        <div className="empty-state">
          <span className="icon">🎵</span>
          No hay eventos. ¡Crea el primero!
        </div>
      )}

      {events.map(ev => (
        <div className="card" key={ev.id}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h2>{ev.title}</h2>
              <div className="meta">
                📍 {ev.venue || 'Sin venue'} &nbsp;|&nbsp;
                📆 {new Date(ev.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {ev.start_time && ` · ${ev.start_time.slice(0,5)}`}
                {ev.end_time   && ` – ${ev.end_time.slice(0,5)}`}
              </div>
              {ev.notes && <p style={{ fontSize: '.85rem', color: '#aaa', marginBottom: 12 }}>{ev.notes}</p>}
              <span className={`badge badge-${ev.status}`}>{STATUS_LABELS[ev.status]}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/party/${ev.id}`)}>
              📋 Lista colaborativa
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/live/${ev.id}`)}>
              🎤 Pedidos en vivo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ev)}>✏️ Editar</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ev.id)}>🗑️ Eliminar</button>
          </div>
        </div>
      ))}

      {showForm && (
        <EventForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </main>
  );
}
