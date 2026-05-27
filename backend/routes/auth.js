const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(String(email).toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role, telefono: user.telefono },
  });
});

router.get('/me', authRequired, (req, res) => {
  const u = db.prepare('SELECT id, nombre, email, role, telefono, creado_en FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'Usuario no existe' });
  res.json(u);
});

router.post('/change-password', authRequired, (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!actual || !nueva || nueva.length < 6) return res.status(400).json({ error: 'Contraseña nueva mínimo 6 caracteres' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(actual, u.password_hash)) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(nueva, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
