import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { fetchEvent, fetchLists, createList, addSongToList, updateListSong, deleteListSong } from '../api';
import { useSocket } from '../context/SocketContext';
import { ListBulletIcon, PlusIcon, LinkIcon, ClipboardDocumentIcon, CheckIcon, QrCodeIcon, MusicalNoteIcon, CheckCircleIcon, TrashIcon, DocumentTextIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PartyPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const shareBase = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

  const [event, setEvent]   = useState(null);
  const [lists, setLists]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState(null);

  // Form state
  const [newListName, setNewListName] = useState('');
  const [songForm, setSongForm] = useState({ title: '', artist: '', added_by: '' });
  const [addingSong, setAddingSong] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

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
    const url = `${shareBase}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (loading) return <div className="loader">Cargando…</div>;

  const currentList = lists.find(l => l.id === activeList);

  return (
    <main className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} title="Volver">
            <ArrowLeftIcon className="icon-sm" />
          </button>
          <div>
            <h1><ListBulletIcon className="icon-inline" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />Lista colaborativa</h1>
            {event && <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: 4 }}>{event.title} · {event.venue}</p>}
          </div>
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
          <button type="submit" className="btn btn-primary btn-sm"><PlusIcon className="icon-sm" /> Crear</button>
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
            <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 6 }}><LinkIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} /> Enlace para compartir con el público:</div>
            <div className="share-box">
              <input readOnly value={`${shareBase}/share/${currentList.share_token}`} />
              <button className="btn btn-secondary btn-sm" onClick={() => copyShareLink(currentList.share_token)}>
                {copied ? <><CheckIcon className="icon-sm" /> Copiado</> : <><ClipboardDocumentIcon className="icon-sm" /> Copiar</>}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowQR(true)}>
                <QrCodeIcon className="icon-sm" /> QR
              </button>
            </div>
          </div>

          {/* QR Code Modal */}
          {showQR && (
            <div className="modal-overlay" onClick={() => setShowQR(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                <h2><QrCodeIcon className="icon-inline" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />Código QR</h2>
                <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 16 }}>Escanea para acceder a la lista</p>
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, display: 'inline-block' }}>
                  <QRCodeSVG
                    value={`${shareBase}/share/${currentList.share_token}`}
                    size={220}
                    level="H"
                  />
                </div>
                <div className="modal-actions" style={{ justifyContent: 'center', marginTop: 20 }}>
                  <button className="btn btn-secondary" onClick={() => setShowQR(false)}>Cerrar</button>
                </div>
              </div>
            </div>
          )}

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
                {addingSong ? 'Añadiendo…' : <><PlusIcon className="icon-sm" /> Añadir canción</>}
              </button>
            </form>
          </div>

          {/* Song list */}
          {(!currentList.songs || currentList.songs.length === 0) && (
            <div className="empty-state">
              <MusicalNoteIcon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', color: 'var(--muted)' }} />
              Lista vacía. ¡Agrega canciones!
            </div>
          )}

          {(currentList.songs || []).map(song => (
            <div className={`song-item${song.played ? ' played' : ''}`} key={song.id}>
              <div>{song.played ? <CheckCircleIcon className="icon-inline" style={{ color: 'var(--success)' }} /> : <MusicalNoteIcon className="icon-inline" style={{ color: 'var(--accent)' }} />}</div>
              <div className="song-info">
                <div className="song-title">{song.title}</div>
                {song.artist && <div className="song-artist">{song.artist}</div>}
                <div className="song-added-by">por {song.added_by}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => togglePlayed(currentList, song)}>
                  {song.played ? 'Desmarcar' : 'Tocada'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(currentList, song.id)}><TrashIcon className="icon-sm" /></button>
              </div>
            </div>
          ))}
        </>
      )}

      {lists.length === 0 && !loading && (
        <div className="empty-state">
          <DocumentTextIcon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', color: 'var(--muted)' }} />
          Sin listas aún. Crea una arriba.
        </div>
      )}
    </main>
  );
}
