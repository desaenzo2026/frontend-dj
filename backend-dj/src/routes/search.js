const express = require('express');
const router  = express.Router();

// GET /api/search?q=... — proxy de autocompletado de YouTube
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 150);
    if (!q) return res.json([]);

    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return res.json([]);

    const data = await response.json();
    // data[1] contiene el array de sugerencias
    res.json(Array.isArray(data[1]) ? data[1].slice(0, 7) : []);
  } catch (err) {
    // En caso de fallo del proxy, devolver array vacío (no bloquear al usuario)
    res.json([]);
  }
});

module.exports = router;
