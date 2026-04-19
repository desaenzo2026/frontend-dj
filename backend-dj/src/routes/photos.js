const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const pool    = require('../config/database');
const auth    = require('../middleware/auth');

const router = express.Router();

// ─── Storage config ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── PUBLIC: Upload a photo ──────────────────────────────────────────────────
router.post('/:eventId', upload.single('photo'), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const uploadedBy = req.body.uploaded_by || 'Anónimo';

    if (!req.file) return res.status(400).json({ error: 'No se envió ninguna foto' });

    // Verify event exists
    const evResult = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (evResult.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO event_photos (event_id, filename, original_name, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [eventId, req.file.filename, req.file.originalname, uploadedBy]
    );

    const photo = rows[0];

    // Emit to projector screens
    const io = req.app.get('io');
    io.to(`photowall:${eventId}`).emit('photo:new', photo);

    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
});

// ─── PUBLIC: Get photos for an event ─────────────────────────────────────────
router.get('/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM event_photos
       WHERE event_id = $1 AND approved = true
       ORDER BY created_at DESC`,
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── PROTECTED: Delete a photo ───────────────────────────────────────────────
router.delete('/:eventId/:photoId', auth, async (req, res, next) => {
  try {
    const { eventId, photoId } = req.params;
    await pool.query(
      'DELETE FROM event_photos WHERE id = $1 AND event_id = $2',
      [photoId, eventId]
    );

    const io = req.app.get('io');
    io.to(`photowall:${eventId}`).emit('photo:removed', { id: photoId });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
