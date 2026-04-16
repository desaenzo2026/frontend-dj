/**
 * Centralised API layer — all calls go through here.
 * Base URL is read from the Vite env variable (falls back to proxy path).
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('dj_token');
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
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
