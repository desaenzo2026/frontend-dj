const express = require('express');
const router  = express.Router();

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';

async function searchWithYoutubeDataApi(query) {
  const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '7',
    q: query,
    fields: 'items(snippet/title,snippet/channelTitle)',
  });

  const response = await fetch(`${YOUTUBE_API_BASE_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const seen = new Set();
  const suggestions = [];

  for (const item of data.items || []) {
    const title = String(item?.snippet?.title || '').trim();
    const channel = String(item?.snippet?.channelTitle || '').trim();
    if (!title) continue;

    const candidate = channel ? `${title} - ${channel}` : title;
    const normalized = candidate.toLowerCase();
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    suggestions.push(candidate);

    if (suggestions.length >= 7) break;
  }

  return suggestions;
}

async function searchWithYoutubeSuggest(query) {
  const url = `${YOUTUBE_SUGGEST_URL}?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data[1]) ? data[1].slice(0, 7) : [];
}

// GET /api/search?q=... — proxy de autocompletado de YouTube
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 150);
    if (!q) return res.json([]);

    // Prefer YouTube Data API when key is configured. If unavailable/fails,
    // fallback to the lightweight suggest endpoint so UX remains responsive.
    const apiSuggestions = await searchWithYoutubeDataApi(q);
    if (Array.isArray(apiSuggestions) && apiSuggestions.length > 0) {
      return res.json(apiSuggestions);
    }

    const fallbackSuggestions = await searchWithYoutubeSuggest(q);
    return res.json(fallbackSuggestions);
  } catch (err) {
    // En caso de fallo del proxy, devolver array vacío (no bloquear al usuario)
    return res.json([]);
  }
});

module.exports = router;
