const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id, nombre, email, role, telefono, avatar_url, activo, creado_en FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  sql += ' ORDER BY role, nombre';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requireRole('admin'), (req, res) => {
  const { nombre, email, password, role, telefono } = req.body;
  if (!nombre || !email || !password || !role) return res.status(400).json({ error: 'Faltan campos' });
  if (!['admin','tecnico','vendedor'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Email ya registrado' });
  const r = db.prepare(`
    INSERT INTO users (nombre, email, password_hash, role, telefono)
    VALUES (?,?,?,?,?)
  `).run(nombre, email.toLowerCase().trim(), bcrypt.hashSync(password, 10), role, telefono || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { nombre, email, role, telefono, activo, password } = req.body;
  const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'No encontrado' });
  const newHash = password ? bcrypt.hashSync(password, 10) : cur.password_hash;
  db.prepare(`
    UPDATE users SET nombre=?, email=?, role=?, telefono=?, activo=?, password_hash=? WHERE id=?
  `).run(nombre || cur.nombre, (email || cur.email).toLowerCase().trim(),
         role || cur.role, telefono ?? cur.telefono,
         activo === undefined ? cur.activo : (activo ? 1 : 0),
         newHash, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
  db.prepare('UPDATE users SET activo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Resumen por vendedora/vendedor
router.get('/:id/ventas-resumen', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role === 'vendedor' && req.user.id !== id) return res.status(403).json({ error: 'Sin permiso' });
  const total = db.prepare(`
    SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS monto
    FROM sales WHERE vendedor_id = ? AND estado != 'anulada'
  `).get(id);
  const mes = db.prepare(`
    SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS monto
    FROM sales WHERE vendedor_id = ? AND estado != 'anulada'
      AND strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
  `).get(id);
  const porDia = db.prepare(`
    SELECT DATE(fecha) AS dia, COUNT(*) AS ventas, SUM(total) AS monto
    FROM sales WHERE vendedor_id = ? AND estado != 'anulada' AND fecha >= datetime('now','-30 day')
    GROUP BY DATE(fecha) ORDER BY dia
  `).all(id);
  res.json({ total, mes, porDia });
});

module.exports = router;
