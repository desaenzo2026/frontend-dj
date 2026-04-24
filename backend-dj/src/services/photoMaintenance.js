const path = require('path');
const fsp = require('fs/promises');
const pool = require('../config/database');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');
const RETENTION_DAYS = Number(process.env.PHOTO_RETENTION_DAYS || 30);
const CLEANUP_EVERY_HOURS = Number(process.env.PHOTO_CLEANUP_EVERY_HOURS || 24);

async function removeFileSafe(filename) {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function purgeOldPhotos(io) {
  const { rows } = await pool.query(
    `DELETE FROM event_photos
     WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
     RETURNING id, event_id, filename`,
    [RETENTION_DAYS]
  );

  if (!rows.length) return 0;

  for (const photo of rows) {
    await removeFileSafe(photo.filename);
    if (io) {
      io.to(`photowall:${photo.event_id}`).emit('photo:removed', { id: photo.id });
    }
  }

  return rows.length;
}

function startPhotoCleanupJob(io) {
  const runCleanup = async () => {
    try {
      const deletedCount = await purgeOldPhotos(io);
      if (deletedCount > 0) {
        console.log(`✓ Limpieza de fotos: ${deletedCount} foto(s) eliminadas por antiguedad`);
      }
    } catch (err) {
      console.error('Photo cleanup failed:', err.message);
    }
  };

  runCleanup();

  const intervalMs = Math.max(1, CLEANUP_EVERY_HOURS) * 60 * 60 * 1000;
  const timer = setInterval(runCleanup, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = {
  purgeOldPhotos,
  startPhotoCleanupJob,
};
