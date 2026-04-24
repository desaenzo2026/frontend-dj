/**
 * Centralised API layer — all calls go through here.
 * Base URL is read from the Vite env variable (falls back to proxy path).
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('dj_token');
}

// Map known backend messages to user-friendly Spanish strings
const FRIENDLY_MESSAGES = {
  'Credenciales incorrectas':       'Usuario o contraseña incorrectos',
  'Invalid credentials':            'Usuario o contraseña incorrectos',
  'usuario y contraseña requeridos': 'Completá usuario y contraseña',
  'Unauthorized':                   'Sesión expirada. Volvé a iniciar sesión',
  'Not found':                      'No se encontró el recurso',
  'Forbidden':                      'No tenés permiso para esta acción',
};

function sanitizeError(raw) {
  if (!raw || typeof raw !== 'string') return 'Ocurrió un error inesperado';
  return FRIENDLY_MESSAGES[raw] || 'Ocurrió un error inesperado. Intentá de nuevo.';
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('El servidor no respondió correctamente');
  }

  if (!res.ok) throw new Error(sanitizeError(data.error));
  return data;
}

const get  = (path)        => request('GET', path);
const post = (path, body)  => request('POST', path, body);
const put  = (path, body)  => request('PUT',  path, body);
const del  = (path)        => request('DELETE', path);

// ─── Events ───────────────────────────────────────
export const fetchEvents        = ()       => get('/events');
export const fetchEvent         = (id)     => get(`/events/${id}`);
export const createEvent        = (data)   => post('/events', data);
export const updateEvent        = (id, d)  => put(`/events/${id}`, d);
export const deleteEvent        = (id)     => del(`/events/${id}`);

// ─── Song Lists ───────────────────────────────────
export const fetchLists         = (eventId)  => get(`/lists?event_id=${eventId}`);
export const fetchListByToken   = (token)    => get(`/lists/share/${token}`);
export const createList         = (data)     => post('/lists', data);

export const addSongToList      = (listId, data) => post(`/lists/${listId}/songs`, data);
export const addSongToSharedList = (token, data)  => post(`/lists/share/${token}/songs`, data);
export const updateListSong     = (listId, songId, data) => put(`/lists/${listId}/songs/${songId}`, data);
export const deleteListSong     = (listId, songId) => del(`/lists/${listId}/songs/${songId}`);

// ─── Requests ─────────────────────────────────────
export const fetchRequests      = (eventId) => get(`/requests?event_id=${eventId}`);
export const createRequest      = (data)    => post('/requests', data);
export const voteRequest        = (id, voterToken) => post(`/requests/${id}/vote`, { voter_token: voterToken });
export const updateRequestStatus = (id, status)    => put(`/requests/${id}/status`, { status });

// ─── Auth ──────────────────────────────────────────
export const loginDJ = (username, password) => post('/auth/login', { username, password });

// ─── YouTube autocomplete ──────────────────────────
export const searchYoutube = (q) => get(`/search?q=${encodeURIComponent(q)}`);

// ─── Photos (Photo Wall) ──────────────────────────
export const fetchPhotos = (eventId) => get(`/photos/${eventId}`);
export const buildPhotoDownloadUrl = (eventId, photoId) => `${BASE}/photos/${eventId}/${photoId}/download`;
export const buildAllPhotosDownloadUrl = (eventId) => `${BASE}/photos/${eventId}/download/all`;

export async function uploadPhoto(eventId, files, uploadedBy) {
  const formData = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach(f => formData.append('photo', f));
  if (uploadedBy) formData.append('uploaded_by', uploadedBy);

  const token = localStorage.getItem('dj_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}/photos/${eventId}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Error al subir la foto. Intentá de nuevo.');
  }
  if (!res.ok) throw new Error(sanitizeError(data.error));
  return data;
}

export const deletePhoto = (eventId, photoId) => del(`/photos/${eventId}/${photoId}`);
