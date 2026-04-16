/**
 * Seed script — crea el usuario DJ inicial en la base de datos.
 * Uso: node src/scripts/createUser.js [username] [password]
 * Ejemplo: node src/scripts/createUser.js dj miPassword123
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const db     = require('../config/database');

async function main() {
  const username = process.argv[2] || process.env.DJ_USERNAME || 'dj';
  const password = process.argv[3] || process.env.DJ_PASSWORD;

  if (!password) {
    console.error('❌  Debes indicar una contraseña: node createUser.js <usuario> <contraseña>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await db.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, 'dj')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, username, role, created_at`,
    [username, hash]
  );

  console.log(`✅  Usuario guardado: ${rows[0].username} (${rows[0].role}) — id: ${rows[0].id}`);
  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
