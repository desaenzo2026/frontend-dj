import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { uploadPhoto } from '../api';
import { CameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function PhotoUploadPage() {
  const { eventId } = useParams();
  const fileRef = useRef(null);

  const [name, setName] = useState('');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      await uploadPhoto(eventId, file, name.trim() || undefined);
      setSuccess(true);
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="photo-upload-page">
      <div className="photo-upload-card">
        <h1 className="photo-upload-title">📸 Sube tu foto</h1>
        <p className="photo-upload-subtitle">Tu foto aparecerá en la pantalla del evento</p>

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

          <div
            className="photo-upload-dropzone"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="photo-upload-preview" />
            ) : (
              <>
                <CameraIcon style={{ width: 48, height: 48, color: 'var(--muted)' }} />
                <p>Toca para elegir una foto</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {error && <p className="photo-upload-error">{error}</p>}

          {success && (
            <div className="photo-upload-success">
              <CheckCircleIcon style={{ width: 24, height: 24 }} />
              <span>¡Foto subida! Aparecerá en la pantalla.</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary photo-upload-btn"
            disabled={!file || uploading}
          >
            {uploading ? 'Subiendo...' : 'Subir foto'}
          </button>

          {success && (
            <button
              type="button"
              className="btn btn-ghost photo-upload-btn"
              onClick={() => { setSuccess(false); fileRef.current?.click(); }}
            >
              Subir otra foto
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
