const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Listar ventas (admin ve todas; vendedor solo las suyas)
router.get('/', (req, res) => {
  const { desde, hasta, vendedorId } = req.query;
  let sql = `
    SELECT s.*, u.nombre AS vendedor_nombre,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS n_items
    FROM sales s JOIN users u ON u.id = s.vendedor_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'vendedor') { sql += ' AND s.vendedor_id = ?'; params.push(req.user.id); }
  else if (vendedorId) { sql += ' AND s.vendedor_id = ?'; params.push(vendedorId); }
  if (desde) { sql += ' AND s.fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND s.fecha <= ?'; params.push(hasta + ' 23:59:59'); }
  sql += ' ORDER BY s.fecha DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, u.nombre AS vendedor_nombre
    FROM sales s JOIN users u ON u.id = s.vendedor_id WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.role === 'vendedor' && sale.vendedor_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

// Registrar venta (admin o vendedor)
router.post('/', requireRole('admin', 'vendedor'), (req, res) => {
  const { cliente_nombre, cliente_dni, cliente_tel, metodo_pago, items, notas } = req.body;
  if (!cliente_nombre || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'cliente_nombre y al menos un ítem son requeridos' });
  }

  const trx = db.transaction(() => {
    let subtotal = 0;
    const procesados = [];
    for (const it of items) {
      const cant = Number(it.cantidad) || 1;
      const precio = Number(it.precio_unit);
      if (!precio || precio <= 0) throw new Error('Precio inválido en uno de los ítems');
      let inv = null;
      if (it.inventory_id) {
        inv = db.prepare('SELECT * FROM inventory WHERE id = ?').get(it.inventory_id);
        if (!inv) throw new Error('Producto no encontrado');
        if (inv.stock < cant) throw new Error(`Stock insuficiente para ${inv.nombre}`);
      }
      const sub = +(cant * precio).toFixed(2);
      subtotal += sub;
      procesados.push({ inv, cant, precio, sub, descripcion: it.descripcion || (inv ? inv.nombre : 'Servicio') });
    }
    subtotal = +subtotal.toFixed(2);
    const igv = +(subtotal * 0.18).toFixed(2);
    const total = +(subtotal + igv).toFixed(2);
    const last = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(boleta_numero, 6) AS INTEGER)), 1000) AS n FROM sales WHERE boleta_numero LIKE 'B001-%'").get().n;
    const boleta = 'B001-' + String(last + 1).padStart(6, '0');

    const ins = db.prepare(`
      INSERT INTO sales (boleta_numero, vendedor_id, cliente_nombre, cliente_dni, cliente_tel, subtotal, igv, total, metodo_pago, notas)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(boleta, req.user.id, cliente_nombre, cliente_dni || null, cliente_tel || null,
           subtotal, igv, total, metodo_pago || 'efectivo', notas || null);
    const saleId = ins.lastInsertRowid;

    const itemIns = db.prepare('INSERT INTO sale_items (sale_id, inventory_id, descripcion, cantidad, precio_unit, subtotal) VALUES (?,?,?,?,?,?)');
    const stockUpd = db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?');
    for (const p of procesados) {
      itemIns.run(saleId, p.inv ? p.inv.id : null, p.descripcion, p.cant, p.precio, p.sub);
      if (p.inv) stockUpd.run(p.cant, p.inv.id);
    }
    return { id: saleId, boleta, total };
  });

  try { res.status(201).json(trx()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/anular', requireRole('admin'), (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'No encontrada' });
  if (sale.estado === 'anulada') return res.status(400).json({ error: 'Ya estaba anulada' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  const trx = db.transaction(() => {
    db.prepare("UPDATE sales SET estado='anulada' WHERE id=?").run(req.params.id);
    for (const it of items) {
      if (it.inventory_id) db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(it.cantidad, it.inventory_id);
    }
  });
  trx();
  res.json({ ok: true });
});

module.exports = router;
