const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const { categoria, q, soloActivos } = req.query;
  let sql = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  if (soloActivos !== 'false') { sql += ' AND activo = 1'; }
  if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
  if (q) { sql += ' AND (nombre LIKE ? OR sku LIKE ? OR marca LIKE ?)'; const like = `%${q}%`; params.push(like, like, like); }
  sql += ' ORDER BY categoria, nombre';
  res.json(db.prepare(sql).all(...params));
});

router.get('/categorias', (req, res) => {
  res.json(db.prepare('SELECT categoria, COUNT(*) AS total FROM inventory WHERE activo=1 GROUP BY categoria ORDER BY categoria').all());
});

router.get('/bajo-stock', (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory WHERE activo=1 AND stock <= stock_min ORDER BY stock ASC').all());
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { sku, nombre, categoria, marca, descripcion, precio_compra, precio_venta, stock, stock_min, imagen_url } = req.body;
  if (!nombre || !categoria) return res.status(400).json({ error: 'nombre y categoria requeridos' });
  const r = db.prepare(`
    INSERT INTO inventory (sku, nombre, categoria, marca, descripcion, precio_compra, precio_venta, stock, stock_min, imagen_url)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(sku || null, nombre, categoria, marca || null, descripcion || null,
         Number(precio_compra) || 0, Number(precio_venta) || 0,
         Number(stock) || 0, Number(stock_min) || 1, imagen_url || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const cur = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'No encontrado' });
  const patch = { ...cur, ...req.body, actualizado_en: new Date().toISOString().slice(0,19).replace('T',' ') };
  db.prepare(`
    UPDATE inventory SET sku=?, nombre=?, categoria=?, marca=?, descripcion=?,
      precio_compra=?, precio_venta=?, stock=?, stock_min=?, imagen_url=?, activo=?, actualizado_en=?
    WHERE id=?
  `).run(patch.sku, patch.nombre, patch.categoria, patch.marca, patch.descripcion,
         Number(patch.precio_compra), Number(patch.precio_venta), Number(patch.stock),
         Number(patch.stock_min), patch.imagen_url, patch.activo ? 1 : 0,
         patch.actualizado_en, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE inventory SET activo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
