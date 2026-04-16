import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchListByToken, addSongToSharedList } from '../api';
import SongAutocomplete from '../components/SongAutocomplete';
import { useSocket } from '../context/SocketContext';
import { MusicalNoteIcon, PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function SharedListPage() {
  const { token } = useParams();
  const { socket } = useSocket();

  const [list, setList]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [form, setForm]     = useState({ title: '', artist: '', added_by: '' });
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setList(await fetchListByToken(token));
    } catch (e) {
      setError('Lista no encontrada o inactiva.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadList(); }, [loadList]);

  // Real-time updates
  useEffect(() => {
    if (!socket.current || !list) return;
    const s = socket.current;
    s.emit('join:list', list.id);

    const onAdded   = (song) => setList(l => ({ ...l, songs: [...(l.songs || []), song] }));
    const onUpdated = (song) => setList(l => ({ ...l, songs: (l.songs || []).map(sg => sg.id === song.id ? song : sg) }));
    const onRemoved = ({ id }) => setList(l => ({ ...l, songs: (l.songs || []).filter(sg => sg.id !== id) }));

    s.on('list:song_added',   onAdded);
    s.on('list:song_updated', onUpdated);
    s.on('list:song_removed', onRemoved);

    return () => {
      s.emit('leave:list', list.id);
      s.off('list:song_added',   onAdded);
      s.off('list:song_updated', onUpdated);
      s.off('list:song_removed', onRemoved);
    };
  }, [socket, list?.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await addSongToSharedList(token, {
        title:    form.title.trim(),
        artist:   form.artist.trim() || undefined,
        added_by: form.added_by.trim() || 'Anónimo',
      });
      setForm({ title: '', artist: '', added_by: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loader">Cargando lista…</div>;
  if (error)   return <div className="empty-state"><XCircleIcon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', color: 'var(--muted)' }} />{error}</div>;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img src="/logo.jpg" alt="Anich Sistemas" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
            <h1>{list.name}</h1>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 4 }}>Lista colaborativa — ¡todos pueden añadir canciones!</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="form-group">
              <label>Canción *</label>
              <SongAutocomplete
                value={form.title}
                onChange={v => setForm(f => ({ ...f, title: v }))}
                onSelect={s => setForm(f => ({ ...f, title: s }))}
                placeholder="Nombre de la canción"
              />
            </div>
            <div className="form-group">
              <label>Artista</label>
              <input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="Nombre del artista" />
            </div>
            <div className="form-group">
              <label>Tu nombre</label>
              <input value={form.added_by} onChange={e => setForm(f => ({ ...f, added_by: e.target.value }))} placeholder="Anónimo" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Añadiendo…' : <><PlusIcon className="icon-sm" /> Añadir a la lista</>}
          </button>
        </form>
      </div>

      {(!list.songs || list.songs.length === 0) && (
        <div className="empty-state">
          <MusicalNoteIcon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', color: 'var(--muted)' }} />
          Sé el primero en añadir una canción.
        </div>
      )}

      {(list.songs || []).map(song => (
        <div className={`song-item${song.played ? ' played' : ''}`} key={song.id}>
          <div>{song.played ? <CheckCircleIcon className="icon-inline" style={{ color: 'var(--success)' }} /> : <MusicalNoteIcon className="icon-inline" style={{ color: 'var(--accent)' }} />}</div>
          <div className="song-info">
            <div className="song-title">{song.title}</div>
            {song.artist && <div className="song-artist">{song.artist}</div>}
            <div className="song-added-by">añadida por {song.added_by}</div>
          </div>
        </div>
      ))}
    </main>
  );
}
