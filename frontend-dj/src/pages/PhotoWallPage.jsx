import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { fetchPhotos } from '../api';
import { useSocket } from '../context/SocketContext';

const UPLOADS_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '';

export default function PhotoWallPage() {
  const { eventId } = useParams();
  const { socket } = useSocket();
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef(null);

  const publicUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  const uploadUrl = `${publicUrl}/photos/upload/${eventId}`;

  // Load existing photos + poll every 8s as fallback
  useEffect(() => {
    const load = () => fetchPhotos(eventId).then(setPhotos).catch(console.error);
    load();
    const poll = setInterval(load, 8000);
    return () => clearInterval(poll);
  }, [eventId]);

  // Socket: listen for new/removed photos
  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;
    s.emit('join:photowall', eventId);

    const onNew = (photo) => {
      setPhotos((prev) => {
        if (prev.some(p => p.id === photo.id)) return prev;
        return [photo, ...prev];
      });
    };
    const onRemoved = ({ id }) => {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    };

    s.on('photo:new', onNew);
    s.on('photo:removed', onRemoved);

    return () => {
      s.emit('leave:photowall', eventId);
      s.off('photo:new', onNew);
      s.off('photo:removed', onRemoved);
    };
  }, [socket, eventId]);

  // Slideshow auto-advance
  useEffect(() => {
    if (photos.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % photos.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [photos.length]);

  // Reset index if out of bounds
  useEffect(() => {
    if (currentIndex >= photos.length) setCurrentIndex(0);
  }, [photos.length, currentIndex]);

  const currentPhoto = photos[currentIndex];

  return (
    <div className="photowall-screen">
      {/* QR Section */}
      <div className="photowall-qr-section">
        <QRCodeSVG value={uploadUrl} size={180} bgColor="transparent" fgColor="#ffffff" />
        <p className="photowall-qr-text">Escanea para subir fotos</p>
      </div>

      {/* Photo display */}
      <div className="photowall-display">
        {currentPhoto ? (
          <img
            key={currentPhoto.id}
            src={`${UPLOADS_BASE}/uploads/photos/${currentPhoto.filename}`}
            alt={currentPhoto.original_name || 'Foto del evento'}
            className="photowall-image"
          />
        ) : (
          <div className="photowall-empty">
            <p>📸</p>
            <p>Esperando fotos...</p>
            <p className="photowall-hint">¡Escanea el QR y sube la primera!</p>
          </div>
        )}
      </div>

      {/* Photo counter */}
      {photos.length > 1 && (
        <div className="photowall-counter">
          {currentIndex + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}
