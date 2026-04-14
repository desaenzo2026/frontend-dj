import { useState } from 'react';

const EMPTY = { title: '', venue: '', event_date: '', start_time: '', end_time: '', notes: '', status: 'upcoming' };

export default function EventForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...( initial ? {
      title:      initial.title      || '',
      venue:      initial.venue      || '',
      event_date: initial.event_date ? initial.event_date.slice(0,10) : '',
      start_time: initial.start_time ? initial.start_time.slice(0,5)  : '',
      end_time:   initial.end_time   ? initial.end_time.slice(0,5)    : '',
      notes:      initial.notes      || '',
      status:     initial.status     || 'upcoming',
    } : {})
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        start_time: form.start_time || null,
        end_time:   form.end_time   || null,
        notes:      form.notes      || null,
        venue:      form.venue      || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{initial ? 'Editar Evento' : 'Nuevo Evento'}</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nombre del evento *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Fiesta XYZ" />
          </div>
          <div className="form-group">
            <label>Venue</label>
            <input value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Club Nocturno, Barcelona" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha *</label>
              <input required type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hora inicio</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hora fin</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="upcoming">Próximo</option>
              <option value="active">Activo</option>
              <option value="completed">Finalizado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Rider, contactos, etc." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
