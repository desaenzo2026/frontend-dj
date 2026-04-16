const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const requireAuth = require('../middleware/auth');

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM events ORDER BY event_date ASC, start_time ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/events/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM events WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/events  [DJ only]
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, venue, event_date, start_time, end_time, notes } = req.body;
    if (!title || !event_date) {
      return res.status(400).json({ error: 'title and event_date are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO events (title, venue, event_date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, venue || null, event_date, start_time || null, end_time || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/events/:id  [DJ only]
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, venue, event_date, start_time, end_time, notes, status } = req.body;
    const validStatuses = ['upcoming', 'active', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await db.query(
      `UPDATE events SET
         title      = COALESCE($1, title),
         venue      = COALESCE($2, venue),
         event_date = COALESCE($3, event_date),
         start_time = COALESCE($4, start_time),
         end_time   = COALESCE($5, end_time),
         notes      = COALESCE($6, notes),
         status     = COALESCE($7, status)
       WHERE id = $8 RETURNING *`,
      [title, venue, event_date, start_time, end_time, notes, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/events/:id  [DJ only]
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM events WHERE id = $1`, [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Event not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
