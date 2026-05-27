const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Público — para la home (index.html)
router.get('/public', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.orden, c.destacado, c.etiqueta,
           i.id AS inventory_id, i.sku, i.nombre, i.categoria, i.marca, i.descripcion,
           i.precio_venta, i.stock, i.imagen_url
    FROM components_featured c
    JOIN inventory i ON i.id = c.inventory_id
    WHERE i.activo = 1
    ORDER BY c.orden ASC
  `).all();
  res.json(rows);
});

// Resto — autenticado
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT c.*, i.nombre, i.sku, i.precio_venta, i.stock, i.imagen_url, i.categoria
    FROM components_featured c JOIN inventory i ON i.id = c.inventory_id
    ORDER BY c.orden ASC
  `).all());
});

router.post('/', requireRole('admin'), (req, res) => {
  const { inventory_id, orden, destacado, etiqueta } = req.body;
  if (!inventory_id) return res.status(400).json({ error: 'inventory_id requerido' });
  const r = db.prepare('INSERT INTO components_featured (inventory_id, orden, destacado, etiqueta) VALUES (?,?,?,?)')
    .run(inventory_id, Number(orden) || 0, destacado ? 1 : 0, etiqueta || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { orden, destacado, etiqueta } = req.body;
  db.prepare('UPDATE components_featured SET orden=?, destacado=?, etiqueta=? WHERE id=?')
    .run(Number(orden) || 0, destacado ? 1 : 0, etiqueta || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM components_featured WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
