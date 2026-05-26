import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPendingPhotos, approvePhoto, deletePhoto } from '../api';
import { useSocket } from '../context/SocketContext';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const UPLOADS_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '';

export default function PhotoModerationPage() {
  const { eventId } = useParams();
  const { socket } = useSocket();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(new Set());

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPendingPhotos(eventId);
      setPending(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // Socket: listen for new pending photos from guests uploading
  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;
    s.emit('join:moderation', eventId);

    const onPending = (photo) => {
      setPending(prev => prev.some(p => p.id === photo.id) ? prev : [photo, ...prev]);
    };

    s.on('photo:pending', onPending);
    return () => {
      s.emit('leave:moderation', eventId);
      s.off('photo:pending', onPending);
    };
  }, [socket, eventId]);

  const setProc = (id, active) =>
    setProcessing(prev => { const s = new Set(prev); active ? s.add(id) : s.delete(id); return s; });

  const handleApprove = async (photoId) => {
    setProc(photoId, true);
    try {
      await approvePhoto(eventId, photoId);
      setPending(prev => prev.filter(p => p.id !== photoId));
    } catch (err) {
      console.error(err);
    } finally {
      setProc(photoId, false);
    }
  };

  const handleReject = async (photoId) => {
    setProc(photoId, true);
    try {
      await deletePhoto(eventId, photoId);
      setPending(prev => prev.filter(p => p.id !== photoId));
    } catch (err) {
      console.error(err);
    } finally {
      setProc(photoId, false);
    }
  };

  const reported = pending.filter(p => p.reports > 0);
  const normal   = pending.filter(p => p.reports === 0);

  return (
    <div className="page">
      <div className="mod-header">
        <h1 className="mod-title">Moderación de fotos</h1>
        <span className="mod-badge">
          {loading ? '...' : `${pending.length} pendiente${pending.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {!loading && pending.length === 0 && (
        <div className="mod-empty">
          <CheckCircleIcon style={{ width: 40, height: 40, color: 'var(--success)' }} />
          <p>No hay fotos pendientes de aprobación</p>
        </div>
      )}

      {reported.length > 0 && (
        <section>
          <h2 className="mod-section-title">
            <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />
            Reportadas
          </h2>
          <div className="mod-grid">
            {reported.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                uploadsBase={UPLOADS_BASE}
                processing={processing.has(photo.id)}
                onApprove={() => handleApprove(photo.id)}
                onReject={() => handleReject(photo.id)}
              />
            ))}
          </div>
        </section>
      )}

      {normal.length > 0 && (
        <section style={{ marginTop: reported.length > 0 ? 32 : 0 }}>
          {reported.length > 0 && <h2 className="mod-section-title">Pendientes</h2>}
          <div className="mod-grid">
            {normal.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                uploadsBase={UPLOADS_BASE}
                processing={processing.has(photo.id)}
                onApprove={() => handleApprove(photo.id)}
                onReject={() => handleReject(photo.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PhotoCard({ photo, uploadsBase, processing, onApprove, onReject }) {
  return (
    <div className={`mod-card${photo.reports > 0 ? ' mod-card--reported' : ''}`}>
      <img
        src={`${uploadsBase}/uploads/photos/${photo.filename}`}
        alt={photo.original_name || 'Foto'}
        className="mod-thumb"
      />
      <div className="mod-card-info">
        <span className="mod-uploader">{photo.uploaded_by || 'Anónimo'}</span>
        {photo.reports > 0 && (
          <span className="mod-reports">
            <ExclamationTriangleIcon style={{ width: 13, height: 13 }} />
            {photo.reports} reporte{photo.reports !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="mod-actions">
        <button
          className="mod-btn mod-btn--approve"
          onClick={onApprove}
          disabled={processing}
        >
          <CheckCircleIcon style={{ width: 16, height: 16 }} />
          Aprobar
        </button>
        <button
          className="mod-btn mod-btn--reject"
          onClick={onReject}
          disabled={processing}
        >
          <XCircleIcon style={{ width: 16, height: 16 }} />
          Rechazar
        </button>
      </div>
    </div>
  );
}
