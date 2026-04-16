const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const requireAuth = require('../middleware/auth');

// GET /api/lists?event_id=xxx
router.get('/', async (req, res, next) => {
  try {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    const { rows } = await db.query(
      `SELECT sl.*,
         (SELECT json_agg(ls ORDER BY ls.position ASC, ls.created_at ASC)
          FROM list_songs ls WHERE ls.list_id = sl.id) AS songs
       FROM song_lists sl
       WHERE sl.event_id = $1
       ORDER BY sl.created_at DESC`,
      [event_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/lists/share/:token  — public, shareable link
router.get('/share/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT sl.*,
         (SELECT json_agg(ls ORDER BY ls.position ASC, ls.created_at ASC)
          FROM list_songs ls WHERE ls.list_id = sl.id) AS songs
       FROM song_lists sl
       WHERE sl.share_token = $1 AND sl.is_active = true`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'List not found or inactive' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/lists  [DJ only]
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { event_id, name } = req.body;
    if (!event_id || !name) return res.status(400).json({ error: 'event_id and name are required' });
    const { rows } = await db.query(
      `INSERT INTO song_lists (event_id, name) VALUES ($1, $2) RETURNING *`,
      [event_id, name]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/lists/share/:token/songs  [PUBLIC — guests can add songs]
router.post('/share/:token/songs', async (req, res, next) => {
  try {
    const { rows: listRows } = await db.query(
      `SELECT id FROM song_lists WHERE share_token = $1 AND is_active = true`,
      [req.params.token]
    );
    if (!listRows.length) return res.status(404).json({ error: 'List not found or inactive' });
    const listId = listRows[0].id;
    const { title, artist, added_by, position } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const { rows } = await db.query(
      `INSERT INTO list_songs (list_id, title, artist, added_by, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [listId, title, artist || null, added_by || 'Anónimo', position || 0]
    );
    const io = req.app.get('io');
    io.to(`list:${listId}`).emit('list:song_added', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/lists/:id/songs  [DJ only]
router.post('/:id/songs', requireAuth, async (req, res, next) => {
  try {
    const { title, artist, added_by, position } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const { rows } = await db.query(
      `INSERT INTO list_songs (list_id, title, artist, added_by, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, title, artist || null, added_by || 'Anónimo', position || 0]
    );
    const io = req.app.get('io');
    // Notify clients watching this list
    io.to(`list:${req.params.id}`).emit('list:song_added', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/lists/:listId/songs/:songId  [DJ only]
router.put('/:listId/songs/:songId', requireAuth, async (req, res, next) => {
  try {
    const { title, artist, position, played } = req.body;
    const { rows } = await db.query(
      `UPDATE list_songs SET
         title    = COALESCE($1, title),
         artist   = COALESCE($2, artist),
         position = COALESCE($3, position),
         played   = COALESCE($4, played)
       WHERE id = $5 AND list_id = $6 RETURNING *`,
      [title, artist, position, played, req.params.songId, req.params.listId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Song not found' });
    const io = req.app.get('io');
    io.to(`list:${req.params.listId}`).emit('list:song_updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/lists/:listId/songs/:songId  [DJ only]
router.delete('/:listId/songs/:songId', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM list_songs WHERE id = $1 AND list_id = $2`,
      [req.params.songId, req.params.listId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Song not found' });
    const io = req.app.get('io');
    io.to(`list:${req.params.listId}`).emit('list:song_removed', { id: req.params.songId });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
