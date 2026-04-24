const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const fsp     = require('fs/promises');
const archiver = require('archiver');
const sharp   = require('sharp');
const pool    = require('../config/database');
const auth    = require('../middleware/auth');

const router = express.Router();

// ─── Storage config ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');
const WATERMARK_LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.jpg');
const HAS_WATERMARK_LOGO = fs.existsSync(WATERMARK_LOGO_PATH);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

async function applyWatermark(filePath) {
  if (!HAS_WATERMARK_LOGO) return;

  const sourceBuffer = await fsp.readFile(filePath);
  const metadata = await sharp(sourceBuffer, { failOn: 'none' }).metadata();
  if (!metadata.width) return;

  const logoWidth = Math.max(90, Math.min(380, Math.floor(metadata.width * 0.22)));
  const logoOverlay = await sharp(WATERMARK_LOGO_PATH)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .png()
    .ensureAlpha(0.28)
    .toBuffer();

  const ext = path.extname(filePath) || '.jpg';
  const tempPath = `${filePath}.watermarked${ext}`;
  await sharp(sourceBuffer, { failOn: 'none' })
    .rotate()
    .composite([{ input: logoOverlay, gravity: 'southeast' }])
    .toFile(tempPath);

  await fsp.rename(tempPath, filePath);
}

async function removeFileSafe(filename) {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function toSafeZipName(input, fallback = 'archivo') {
  return String(input || fallback)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

// ─── PUBLIC: Upload photos (1 to 10) ─────────────────────────────────────────
router.post('/:eventId', upload.array('photo', 10), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const uploadedBy = req.body.uploaded_by || 'Anónimo';

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se envió ninguna foto' });

    // Verify event exists
    const evResult = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (evResult.rows.length === 0) {
      await Promise.all((req.files || []).map((file) => removeFileSafe(file.filename)));
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const photos = [];
    for (const file of req.files) {
      try {
        await applyWatermark(file.path);
      } catch (err) {
        console.warn(`No se pudo aplicar marca de agua a ${file.filename}:`, err.message);
      }

      const { rows } = await pool.query(
        `INSERT INTO event_photos (event_id, filename, original_name, uploaded_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [eventId, file.filename, file.originalname, uploadedBy]
      );
      const photo = rows[0];
      photos.push(photo);

      // Emit to projector screens
      const io = req.app.get('io');
      io.to(`photowall:${eventId}`).emit('photo:new', photo);
    }

    res.status(201).json(photos.length === 1 ? photos[0] : photos);
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

// ─── PUBLIC: Download a photo ───────────────────────────────────────────────
router.get('/:eventId/:photoId/download', async (req, res, next) => {
  try {
    const { eventId, photoId } = req.params;
    const { rows } = await pool.query(
      `SELECT filename, original_name
       FROM event_photos
       WHERE id = $1 AND event_id = $2 AND approved = true`,
      [photoId, eventId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Foto no encontrada' });

    const photo = rows[0];
    const filePath = path.join(UPLOAD_DIR, photo.filename);
    await fsp.access(filePath);

    const safeOriginalName = (photo.original_name || photo.filename || 'foto-evento.jpg')
      .replace(/[\r\n]/g, ' ')
      .replace(/"/g, '');

    res.download(filePath, safeOriginalName);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Archivo no encontrado' });
    next(err);
  }
});

// ─── PUBLIC: Download all photos in ZIP ─────────────────────────────────────
router.get('/:eventId/download/all', async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const eventResult = await pool.query(
      'SELECT title FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventResult.rows.length) return res.status(404).json({ error: 'Evento no encontrado' });

    const { rows } = await pool.query(
      `SELECT filename, original_name, created_at
       FROM event_photos
       WHERE event_id = $1 AND approved = true
       ORDER BY created_at ASC`,
      [eventId]
    );

    if (!rows.length) return res.status(404).json({ error: 'No hay fotos para descargar' });

    const eventTitle = toSafeZipName(eventResult.rows[0].title, 'evento');
    const archiveName = `${eventTitle}-fotos.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      if (!res.headersSent) return next(err);
      res.destroy(err);
    });

    archive.pipe(res);

    for (let i = 0; i < rows.length; i += 1) {
      const photo = rows[i];
      const filePath = path.join(UPLOAD_DIR, photo.filename);
      try {
        await fsp.access(filePath);
      } catch {
        continue;
      }

      const ext = path.extname(photo.filename) || '.jpg';
      const baseName = toSafeZipName(path.parse(photo.original_name || '').name, `foto-${i + 1}`);
      const entryName = `${String(i + 1).padStart(3, '0')}-${baseName}${ext}`;
      archive.file(filePath, { name: entryName, date: photo.created_at || new Date() });
    }

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

// ─── PROTECTED: Delete a photo ───────────────────────────────────────────────
router.delete('/:eventId/:photoId', auth, async (req, res, next) => {
  try {
    const { eventId, photoId } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM event_photos
       WHERE id = $1 AND event_id = $2
       RETURNING filename`,
      [photoId, eventId]
    );

    if (rows.length > 0) {
      await removeFileSafe(rows[0].filename);
    }

    const io = req.app.get('io');
    io.to(`photowall:${eventId}`).emit('photo:removed', { id: photoId });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
