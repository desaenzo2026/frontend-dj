import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchEvent, fetchLists, createList, addSongToList, updateListSong, deleteListSong } from '../api';
import { useSocket } from '../context/SocketContext';

export default function PartyPage() {
  const { eventId } = useParams();
  const { socket } = useSocket();

  const [event, setEvent]   = useState(null);
  const [lists, setLists]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState(null);

  // Form state
  const [newListName, setNewListName] = useState('');
  const [songForm, setSongForm] = useState({ title: '', artist: '', added_by: '' });
  const [addingSong, setAddingSong] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ev, ls] = await Promise.all([fetchEvent(eventId), fetchLists(eventId)]);
      setEvent(ev);
      setLists(ls);
      if (ls.length && !activeList) setActiveList(ls[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time list updates
  useEffect(() => {
    if (!socket.current || !activeList) return;
    const s = socket.current;
    s.emit('join:list', activeList);

    const onAdded   = (song) => setLists(ls => ls.map(l => l.id === activeList
      ? { ...l, songs: [...(l.songs || []), song] } : l));
    const onUpdated = (song) => setLists(ls => ls.map(l => l.id === activeList
      ? { ...l, songs: (l.songs || []).map(sg => sg.id === song.id ? song : sg) } : l));
    const onRemoved = ({ id }) => setLists(ls => ls.map(l => l.id === activeList
      ? { ...l, songs: (l.songs || []).filter(sg => sg.id !== id) } : l));

    s.on('list:song_added',   onAdded);
    s.on('list:song_updated', onUpdated);
    s.on('list:song_removed', onRemoved);

    return () => {
      s.emit('leave:list', activeList);
      s.off('list:song_added',   onAdded);
      s.off('list:song_updated', onUpdated);
      s.off('list:song_removed', onRemoved);
    };
  }, [socket, activeList]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const l = await createList({ event_id: eventId, name: newListName.trim() });
      setLists(ls => [l, ...ls]);
      setActiveList(l.id);
      setNewListName('');
    } catch (err) { alert(err.message); }
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!songForm.title.trim()) return;
    setAddingSong(true);
    try {
      await addSongToList(activeList, {
        title:    songForm.title.trim(),
        artist:   songForm.artist.trim() || undefined,
        added_by: songForm.added_by.trim() || 'Anónimo',
      });
      setSongForm({ title: '', artist: '', added_by: '' });
    } catch (err) { alert(err.message); }
    finally { setAddingSong(false); }
  };

  const togglePlayed = async (list, song) => {
    await updateListSong(list.id, song.id, { played: !song.played });
  };

  const handleDelete = async (list, songId) => {
    if (!confirm('¿Eliminar canción?')) return;
    await deleteListSong(list.id, songId);
  };

  const copyShareLink = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (loading) return <div className="loader">Cargando…</div>;

  const currentList = lists.find(l => l.id === activeList);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>📋 Lista colaborativa</h1>
          {event && <p style={{ color: '#888', fontSize: '.9rem', marginTop: 4 }}>{event.title} · {event.venue}</p>}
        </div>
      </div>

      {/* Create new list */}
      <div className="card">
        <form onSubmit={handleCreateList} style={{ display: 'flex', gap: 10 }}>
          <input
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            placeholder="Nombre de la lista (ej: Set 22:00-00:00)"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">+ Crear</button>
        </form>
      </div>

      {/* List tabs */}
      {lists.length > 0 && (
        <div className="tabs">
          {lists.map(l => (
            <button
              key={l.id}
              className={`tab-btn${activeList === l.id ? ' active' : ''}`}
              onClick={() => setActiveList(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {currentList && (
        <>
          {/* Share link */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '.85rem', color: '#888', marginBottom: 6 }}>🔗 Enlace para compartir con el público:</div>
            <div className="share-box">
              <input readOnly value={`${window.location.origin}/share/${currentList.share_token}`} />
              <button className="btn btn-secondary btn-sm" onClick={() => copyShareLink(currentList.share_token)}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Add song form */}
          <div className="card">
            <h2 style={{ marginBottom: 14 }}>Agregar canción</h2>
            <form onSubmit={handleAddSong}>
              <div className="form-row">
                <div className="form-group">
                  <label>Canción *</label>
                  <input required value={songForm.title} onChange={e => setSongForm(f => ({ ...f, title: e.target.value }))} placeholder="Blinding Lights" />
                </div>
                <div className="form-group">
                  <label>Artista</label>
                  <input value={songForm.artist} onChange={e => setSongForm(f => ({ ...f, artist: e.target.value }))} placeholder="The Weeknd" />
                </div>
                <div className="form-group">
                  <label>Añadida por</label>
                  <input value={songForm.added_by} onChange={e => setSongForm(f => ({ ...f, added_by: e.target.value }))} placeholder="Tu nombre" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={addingSong}>
                {addingSong ? 'Añadiendo…' : '+ Añadir canción'}
              </button>
            </form>
          </div>

          {/* Song list */}
          {(!currentList.songs || currentList.songs.length === 0) && (
            <div className="empty-state">
              <span className="icon">🎵</span>
              Lista vacía. ¡Agrega canciones!
            </div>
          )}

          {(currentList.songs || []).map(song => (
            <div className={`song-item${song.played ? ' played' : ''}`} key={song.id}>
              <div style={{ fontSize: '1.2rem' }}>{song.played ? '✅' : '🎵'}</div>
              <div className="song-info">
                <div className="song-title">{song.title}</div>
                {song.artist && <div className="song-artist">{song.artist}</div>}
                <div className="song-added-by">por {song.added_by}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => togglePlayed(currentList, song)}>
                  {song.played ? 'Desmarcar' : 'Tocada'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(currentList, song.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </>
      )}

      {lists.length === 0 && !loading && (
        <div className="empty-state">
          <span className="icon">📝</span>
          Sin listas aún. Crea una arriba.
        </div>
      )}
    </main>
  );
}
