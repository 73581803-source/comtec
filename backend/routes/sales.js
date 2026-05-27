const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const TIPOS_VALIDOS = ['boleta', 'proforma', 'nota_venta'];
const PREFIJO_NUM = { boleta: 'B001-', proforma: 'PRO-', nota_venta: 'NV-' };

// Listar (admin ve todas; vendedor solo las suyas)
router.get('/', (req, res) => {
  const { desde, hasta, vendedorId, tipo } = req.query;
  let sql = `
    SELECT s.*, u.nombre AS vendedor_nombre,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS n_items
    FROM sales s JOIN users u ON u.id = s.vendedor_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'vendedor') { sql += ' AND s.vendedor_id = ?'; params.push(req.user.id); }
  else if (vendedorId) { sql += ' AND s.vendedor_id = ?'; params.push(vendedorId); }
  if (tipo) { sql += ' AND s.tipo = ?'; params.push(tipo); }
  if (desde) { sql += ' AND s.fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND s.fecha <= ?'; params.push(hasta + ' 23:59:59'); }
  sql += ' ORDER BY s.fecha DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, u.nombre AS vendedor_nombre, u.email AS vendedor_email
    FROM sales s JOIN users u ON u.id = s.vendedor_id WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.role === 'vendedor' && sale.vendedor_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(req.params.id);
  res.json({ ...sale, items });
});

// Registrar boleta / proforma / nota
router.post('/', requireRole('admin', 'vendedor'), (req, res) => {
  const tipo = (req.body.tipo || 'boleta').toLowerCase();
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });

  const { cliente_nombre, cliente_dni, cliente_tel, metodo_pago, items, notas, valido_hasta } = req.body;
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
        // Solo validar stock cuando es boleta (descuenta inventario)
        if (tipo === 'boleta' && inv.stock < cant) throw new Error(`Stock insuficiente para ${inv.nombre}`);
      }
      const sub = +(cant * precio).toFixed(2);
      subtotal += sub;
      procesados.push({
        inv, cant, precio, sub,
        descripcion: it.descripcion || (inv ? inv.nombre : 'Producto'),
        es_externo: it.es_externo ? 1 : 0,
      });
    }
    subtotal = +subtotal.toFixed(2);
    const igv = tipo === 'nota_venta' ? 0 : +(subtotal * 0.18).toFixed(2);
    const total = +(subtotal + igv).toFixed(2);

    // Numeración por tipo
    const prefijo = PREFIJO_NUM[tipo];
    const last = db.prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(boleta_numero, ${prefijo.length}+1) AS INTEGER)), 1000) AS n
       FROM sales WHERE boleta_numero LIKE ?`
    ).get(prefijo + '%').n;
    const numero = prefijo + String(last + 1).padStart(6, '0');

    const ins = db.prepare(`
      INSERT INTO sales (boleta_numero, tipo, vendedor_id, cliente_nombre, cliente_dni, cliente_tel,
                         subtotal, igv, total, metodo_pago, notas, valido_hasta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(numero, tipo, req.user.id, cliente_nombre, cliente_dni || null, cliente_tel || null,
           subtotal, igv, total, metodo_pago || 'efectivo', notas || null, valido_hasta || null);
    const saleId = ins.lastInsertRowid;

    const itemIns = db.prepare(`
      INSERT INTO sale_items (sale_id, inventory_id, descripcion, cantidad, precio_unit, subtotal, es_externo)
      VALUES (?,?,?,?,?,?,?)
    `);
    const stockUpd = db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?');
    for (const p of procesados) {
      itemIns.run(saleId, p.inv ? p.inv.id : null, p.descripcion, p.cant, p.precio, p.sub, p.es_externo);
      // Descuento de stock solo en boletas reales
      if (tipo === 'boleta' && p.inv) stockUpd.run(p.cant, p.inv.id);
    }
    return { id: saleId, numero, tipo, total };
  });

  try { res.status(201).json(trx()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Convertir proforma a boleta
router.post('/:id/convertir-a-boleta', requireRole('admin', 'vendedor'), (req, res) => {
  const orig = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!orig) return res.status(404).json({ error: 'No encontrada' });
  if (orig.tipo !== 'proforma') return res.status(400).json({ error: 'Solo proformas pueden convertirse' });
  if (req.user.role === 'vendedor' && orig.vendedor_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  // Reusa POST handler armando body equivalente
  const body = {
    tipo: 'boleta',
    cliente_nombre: orig.cliente_nombre,
    cliente_dni: orig.cliente_dni,
    cliente_tel: orig.cliente_tel,
    metodo_pago: orig.metodo_pago,
    notas: 'Convertido desde ' + orig.boleta_numero,
    items: items.map(i => ({
      inventory_id: i.inventory_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unit: i.precio_unit,
      es_externo: i.es_externo,
    })),
  };
  req.body = body;
  // Llamar manualmente al handler POST /
  router.handle({ ...req, method: 'POST', url: '/' }, res, () => {});
});

router.post('/:id/anular', requireRole('admin'), (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'No encontrada' });
  if (sale.estado === 'anulada') return res.status(400).json({ error: 'Ya estaba anulada' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  const trx = db.transaction(() => {
    db.prepare("UPDATE sales SET estado='anulada' WHERE id=?").run(req.params.id);
    // Restituir stock solo si era boleta
    if (sale.tipo === 'boleta') {
      for (const it of items) {
        if (it.inventory_id) db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(it.cantidad, it.inventory_id);
      }
    }
  });
  trx();
  res.json({ ok: true });
});

module.exports = router;
