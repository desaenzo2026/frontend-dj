import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { uploadPhoto } from '../api';
import { CameraIcon, CheckCircleIcon, XMarkIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

const hasMediaDevices = typeof navigator !== 'undefined'
  && navigator.mediaDevices
  && typeof navigator.mediaDevices.getUserMedia === 'function';

export default function PhotoUploadPage() {
  const { eventId } = useParams();
  const fileRef = useRef(null);
  const cameraFileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [name, setName] = useState('');
  const [previews, setPreviews] = useState([]); // { file, url }
  const [uploading, setUploading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  // Clean up object URLs and camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    if (!hasMediaDevices) {
      // Fallback: open native camera via file input with capture attribute
      cameraFileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      });
    } catch {
      // getUserMedia failed — fallback to native camera capture
      cameraFileRef.current?.click();
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setPreviews(prev => [...prev, { file, url }]);
    }, 'image/jpeg', 0.85);
  }, []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPreviews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(prev => [...prev, ...newPreviews]);
    setSuccessCount(0);
    setError('');
    e.target.value = '';
  };

  const removePreview = (index) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!previews.length) return;

    setUploading(true);
    setError('');
    try {
      const files = previews.map(p => p.file);
      await uploadPhoto(eventId, files, name.trim() || undefined);
      setSuccessCount(files.length);
      previews.forEach(p => URL.revokeObjectURL(p.url));
      setPreviews([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="photo-upload-page">
      <div className="photo-upload-card">
        <h1 className="photo-upload-title">📸 Subí tus fotos</h1>
        <p className="photo-upload-subtitle">Tus fotos van a aparecer en la pantalla del evento</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tu nombre (opcional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anónimo"
              maxLength={100}
            />
          </div>

          {/* Camera live view */}
          {showCamera && (
            <div className="photo-camera-wrapper">
              <video ref={videoRef} className="photo-camera-video" autoPlay playsInline muted />
              <div className="photo-camera-actions">
                <button type="button" className="btn btn-primary photo-camera-capture" onClick={capturePhoto}>
                  <CameraIcon style={{ width: 28, height: 28 }} />
                </button>
                <button type="button" className="btn btn-ghost photo-camera-close" onClick={stopCamera}>
                  <XMarkIcon style={{ width: 24, height: 24 }} /> Cerrar cámara
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="photo-upload-actions">
            <button
              type="button"
              className="photo-upload-action-btn"
              onClick={() => fileRef.current?.click()}
            >
              <PhotoIcon style={{ width: 32, height: 32 }} />
              <span>Elegir fotos</span>
            </button>
            <button
              type="button"
              className="photo-upload-action-btn"
              onClick={showCamera ? stopCamera : startCamera}
            >
              <VideoCameraIcon style={{ width: 32, height: 32 }} />
              <span>{showCamera ? 'Cerrar cámara' : 'Abrir cámara'}</span>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {/* Hidden input for native camera capture (mobile fallback when no getUserMedia) */}
          <input
            ref={cameraFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Previews grid */}
          {previews.length > 0 && (
            <div className="photo-upload-grid">
              {previews.map((p, i) => (
                <div key={i} className="photo-upload-thumb">
                  <img src={p.url} alt={`Foto ${i + 1}`} />
                  <button
                    type="button"
                    className="photo-upload-thumb-remove"
                    onClick={() => removePreview(i)}
                  >
                    <XMarkIcon style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="photo-upload-error">{error}</p>}

          {successCount > 0 && (
            <div className="photo-upload-success">
              <CheckCircleIcon style={{ width: 24, height: 24 }} />
              <span>¡{successCount === 1 ? 'Foto subida' : `${successCount} fotos subidas`}! Ya aparecen en la pantalla.</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary photo-upload-btn"
            disabled={!previews.length || uploading}
          >
            {uploading
              ? 'Subiendo...'
              : previews.length > 1
                ? `Subir ${previews.length} fotos`
                : 'Subir foto'}
          </button>

          {successCount > 0 && (
            <button
              type="button"
              className="btn btn-ghost photo-upload-btn"
              onClick={() => { setSuccessCount(0); fileRef.current?.click(); }}
            >
              Subir más fotos
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
