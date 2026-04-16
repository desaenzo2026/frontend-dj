const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const db      = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'usuario y contraseña requeridos' });
    }

    const { rows } = await db.query(
      `SELECT id, username, password_hash, role FROM users WHERE username = $1`,
      [username]
    );

    // Respuesta genérica para no revelar si el usuario existe
    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { role: rows[0].role, sub: rows[0].username, uid: rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token });
  } catch (err) { next(err); }
});

module.exports = router;
