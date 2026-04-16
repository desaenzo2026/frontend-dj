const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const requireAuth = require('../middleware/auth');

// GET /api/requests?event_id=xxx  — ranked by votes desc
router.get('/', async (req, res, next) => {
  try {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    const { rows } = await db.query(
      `SELECT * FROM song_requests
       WHERE event_id = $1
       ORDER BY votes DESC, created_at ASC`,
      [event_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/requests
router.post('/', async (req, res, next) => {
  try {
    const { event_id, title, artist, requested_by } = req.body;
    if (!event_id || !title) {
      return res.status(400).json({ error: 'event_id and title are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO song_requests (event_id, title, artist, requested_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [event_id, title, artist || null, requested_by || 'Anónimo']
    );
    const io = req.app.get('io');
    io.to(`event:${event_id}`).emit('requests:new', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/requests/:id/vote
router.post('/:id/vote', async (req, res, next) => {
  try {
    const { voter_token } = req.body;
    if (!voter_token) return res.status(400).json({ error: 'voter_token is required' });

    // Validate token format to prevent injection (alphanumeric + hyphens, max 100 chars)
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(voter_token)) {
      return res.status(400).json({ error: 'Invalid voter_token format' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Insert vote — unique constraint prevents duplicates
      await client.query(
        `INSERT INTO request_votes (request_id, voter_token) VALUES ($1, $2)`,
        [req.params.id, voter_token]
      );

      // Increment counter
      const { rows } = await client.query(
        `UPDATE song_requests SET votes = votes + 1
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      await client.query('COMMIT');

      if (!rows.length) return res.status(404).json({ error: 'Request not found' });

      const io = req.app.get('io');
      io.to(`event:${rows[0].event_id}`).emit('requests:vote_updated', rows[0]);
      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You already voted for this song' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// PUT /api/requests/:id/status  [DJ only]
router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'played', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await db.query(
      `UPDATE song_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const io = req.app.get('io');
    io.to(`event:${rows[0].event_id}`).emit('requests:status_updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
