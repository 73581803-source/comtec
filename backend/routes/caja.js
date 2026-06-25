const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// SELECT base con totales calculados (ingresos, egresos y total a entregar)
const SELECT_CIERRE = `
  SELECT c.*, t.nombre AS tienda_nombre, u.nombre AS usuario_nombre,
         (c.efectivo + c.yape + c.tarjeta + c.transferencia) AS total_ingresos,
         COALESCE((SELECT SUM(e.monto) FROM cierre_egresos e WHERE e.cierre_id = c.id), 0) AS total_egresos,
         (c.efectivo + c.yape + c.tarjeta + c.transferencia)
           - COALESCE((SELECT SUM(e.monto) FROM cierre_egresos e WHERE e.cierre_id = c.id), 0) AS total_entregar
  FROM cierres_caja c
  JOIN tiendas t ON t.id = c.tienda_id
  JOIN users   u ON u.id = c.usuario_id
`;

// Listado de cierres con filtros
router.get('/', (req, res) => {
  const { tiendaId, desde, hasta } = req.query;
  let sql = SELECT_CIERRE + ' WHERE 1=1';
  const params = [];
  if (tiendaId) { sql += ' AND c.tienda_id = ?'; params.push(tiendaId); }
  if (desde)    { sql += ' AND c.fecha >= ?';    params.push(desde); }
  if (hasta)    { sql += ' AND c.fecha <= ?';    params.push(hasta); }
  sql += ' ORDER BY c.fecha DESC, c.id DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

// Resumen / KPIs (todas las tiendas)
router.get('/resumen', (req, res) => {
  const hoy = db.prepare(`
    SELECT COUNT(*) AS cierres,
           COALESCE(SUM(efectivo + yape + tarjeta + transferencia),0) AS ingresos
    FROM cierres_caja WHERE fecha = date('now')
  `).get();
  const egresosHoy = db.prepare(`
    SELECT COALESCE(SUM(e.monto),0) AS egresos
    FROM cierre_egresos e JOIN cierres_caja c ON c.id = e.cierre_id
    WHERE c.fecha = date('now')
  `).get().egresos;

  // Total entregado por tienda hoy (para ver quién ya entregó)
  const porTiendaHoy = db.prepare(`
    SELECT t.id AS tienda_id, t.nombre AS tienda_nombre,
           c.id AS cierre_id, c.estado,
           COALESCE(c.efectivo + c.yape + c.tarjeta + c.transferencia, 0) AS ingresos,
           COALESCE((SELECT SUM(e.monto) FROM cierre_egresos e WHERE e.cierre_id = c.id), 0) AS egresos
    FROM tiendas t
    LEFT JOIN cierres_caja c ON c.tienda_id = t.id AND c.fecha = date('now')
    WHERE t.activo = 1
    ORDER BY t.nombre
  `).all();

  const mes = db.prepare(`
    SELECT COALESCE(SUM(efectivo + yape + tarjeta + transferencia),0) AS ingresos
    FROM cierres_caja WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
  `).get().ingresos;

  res.json({
    hoy: {
      cierres: hoy.cierres,
      ingresos: hoy.ingresos,
      egresos: egresosHoy,
      entregado: hoy.ingresos - egresosHoy,
    },
    mesIngresos: mes,
    porTiendaHoy,
  });
});

// Detalle de un cierre con sus ventas (ingresos) y egresos
router.get('/:id', (req, res) => {
  const cierre = db.prepare(SELECT_CIERRE + ' WHERE c.id = ?').get(req.params.id);
  if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });
  cierre.ingresos = db.prepare('SELECT * FROM cierre_ingresos WHERE cierre_id = ? ORDER BY id').all(req.params.id);
  cierre.egresos  = db.prepare('SELECT * FROM cierre_egresos  WHERE cierre_id = ? ORDER BY id').all(req.params.id);
  res.json(cierre);
});

const METODOS = ['efectivo', 'yape', 'tarjeta', 'transferencia'];

function normIngresos(ingresos) {
  if (!Array.isArray(ingresos)) return [];
  return ingresos
    .map(i => ({
      descripcion: String(i.descripcion || '').trim(),
      cliente: i.cliente ? String(i.cliente).trim() : null,
      metodo_pago: METODOS.includes(i.metodo_pago) ? i.metodo_pago : 'efectivo',
      monto: Number(i.monto) || 0,
    }))
    .filter(i => i.descripcion && i.monto > 0);
}

// Suma los montos por forma de pago a partir del detalle de ventas
function totalesPorMetodo(ingresos) {
  const t = { efectivo: 0, yape: 0, tarjeta: 0, transferencia: 0 };
  for (const i of ingresos) t[i.metodo_pago] += i.monto;
  return t;
}

function normEgresos(egresos) {
  if (!Array.isArray(egresos)) return [];
  return egresos
    .map(e => ({
      concepto: String(e.concepto || '').trim(),
      proveedor: e.proveedor ? String(e.proveedor).trim() : null,
      monto: Number(e.monto) || 0,
    }))
    .filter(e => e.concepto && e.monto > 0);
}

// Registrar un cierre de caja (admin o vendedor)
router.post('/', requireRole('admin', 'vendedor'), (req, res) => {
  const { tienda_id, fecha, efectivo, yape, tarjeta, transferencia, observaciones, estado, ingresos, egresos } = req.body;
  if (!tienda_id) return res.status(400).json({ error: 'Selecciona una tienda' });
  const tienda = db.prepare('SELECT id FROM tiendas WHERE id = ? AND activo = 1').get(tienda_id);
  if (!tienda) return res.status(400).json({ error: 'Tienda inválida' });

  const ingresosOk = normIngresos(ingresos);
  const egresosOk = normEgresos(egresos);
  // Si viene el detalle de ventas, los totales por método se calculan de ahí.
  // Si no, se respetan los montos enviados (compatibilidad).
  const tm = ingresosOk.length
    ? totalesPorMetodo(ingresosOk)
    : { efectivo: Number(efectivo) || 0, yape: Number(yape) || 0, tarjeta: Number(tarjeta) || 0, transferencia: Number(transferencia) || 0 };

  const crear = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO cierres_caja (tienda_id, fecha, usuario_id, efectivo, yape, tarjeta, transferencia, observaciones, estado)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(tienda_id, fecha || new Date().toISOString().slice(0, 10), req.user.id,
           tm.efectivo, tm.yape, tm.tarjeta, tm.transferencia,
           observaciones || null, estado || 'entregado');
    const cierreId = r.lastInsertRowid;
    const insI = db.prepare('INSERT INTO cierre_ingresos (cierre_id, descripcion, cliente, metodo_pago, monto) VALUES (?,?,?,?,?)');
    for (const i of ingresosOk) insI.run(cierreId, i.descripcion, i.cliente, i.metodo_pago, i.monto);
    const insE = db.prepare('INSERT INTO cierre_egresos (cierre_id, concepto, proveedor, monto) VALUES (?,?,?,?)');
    for (const e of egresosOk) insE.run(cierreId, e.concepto, e.proveedor, e.monto);
    return cierreId;
  });

  res.status(201).json({ id: crear() });
});

// Editar un cierre (reemplaza los egresos)
router.put('/:id', requireRole('admin', 'vendedor'), (req, res) => {
  const cur = db.prepare('SELECT * FROM cierres_caja WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Cierre no encontrado' });
  // Un vendedor solo puede editar lo que él registró
  if (req.user.role === 'vendedor' && cur.usuario_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes editar tus propios cierres' });
  }
  const p = { ...cur, ...req.body };
  const egresosOk = normEgresos(req.body.egresos);
  const tieneLista = Array.isArray(req.body.ingresos);
  const ingresosOk = normIngresos(req.body.ingresos);
  // Si se envía el detalle de ventas, recalcula los totales por método desde él
  const tm = tieneLista
    ? totalesPorMetodo(ingresosOk)
    : { efectivo: Number(p.efectivo) || 0, yape: Number(p.yape) || 0, tarjeta: Number(p.tarjeta) || 0, transferencia: Number(p.transferencia) || 0 };

  const actualizar = db.transaction(() => {
    db.prepare(`
      UPDATE cierres_caja SET tienda_id=?, fecha=?, efectivo=?, yape=?, tarjeta=?, transferencia=?, observaciones=?, estado=?
      WHERE id=?
    `).run(p.tienda_id, p.fecha, tm.efectivo, tm.yape, tm.tarjeta, tm.transferencia,
           p.observaciones || null, p.estado || 'entregado', req.params.id);
    if (tieneLista) {
      db.prepare('DELETE FROM cierre_ingresos WHERE cierre_id = ?').run(req.params.id);
      const insI = db.prepare('INSERT INTO cierre_ingresos (cierre_id, descripcion, cliente, metodo_pago, monto) VALUES (?,?,?,?,?)');
      for (const i of ingresosOk) insI.run(req.params.id, i.descripcion, i.cliente, i.metodo_pago, i.monto);
    }
    if (Array.isArray(req.body.egresos)) {
      db.prepare('DELETE FROM cierre_egresos WHERE cierre_id = ?').run(req.params.id);
      const insE = db.prepare('INSERT INTO cierre_egresos (cierre_id, concepto, proveedor, monto) VALUES (?,?,?,?)');
      for (const e of egresosOk) insE.run(req.params.id, e.concepto, e.proveedor, e.monto);
    }
  });
  actualizar();
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM cierres_caja WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
