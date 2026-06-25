const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Listar tiendas. Por defecto solo activas; admin puede pedir todas con ?todas=1
router.get('/', (req, res) => {
  const todas = req.query.todas === '1' && req.user.role === 'admin';
  const sql = todas
    ? 'SELECT * FROM tiendas ORDER BY activo DESC, nombre'
    : 'SELECT * FROM tiendas WHERE activo = 1 ORDER BY nombre';
  res.json(db.prepare(sql).all());
});

router.post('/', requireRole('admin'), (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre de la tienda es requerido' });
  const r = db.prepare('INSERT INTO tiendas (nombre, direccion, telefono) VALUES (?,?,?)')
    .run(nombre.trim(), direccion || null, telefono || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const cur = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Tienda no encontrada' });
  const p = { ...cur, ...req.body };
  db.prepare('UPDATE tiendas SET nombre=?, direccion=?, telefono=?, activo=? WHERE id=?')
    .run((p.nombre || '').trim() || cur.nombre, p.direccion || null, p.telefono || null,
         p.activo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// Baja lógica (no se borra para no romper inventario / cierres históricos)
router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE tiendas SET activo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
