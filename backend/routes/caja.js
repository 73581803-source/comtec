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

// Detalle de un cierre con sus egresos
router.get('/:id', (req, res) => {
  const cierre = db.prepare(SELECT_CIERRE + ' WHERE c.id = ?').get(req.params.id);
  if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });
  cierre.egresos = db.prepare('SELECT * FROM cierre_egresos WHERE cierre_id = ? ORDER BY id').all(req.params.id);
  res.json(cierre);
});

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
  const { tienda_id, fecha, efectivo, yape, tarjeta, transferencia, observaciones, estado, egresos } = req.body;
  if (!tienda_id) return res.status(400).json({ error: 'Selecciona una tienda' });
  const tienda = db.prepare('SELECT id FROM tiendas WHERE id = ? AND activo = 1').get(tienda_id);
  if (!tienda) return res.status(400).json({ error: 'Tienda inválida' });

  const egresosOk = normEgresos(egresos);

  const crear = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO cierres_caja (tienda_id, fecha, usuario_id, efectivo, yape, tarjeta, transferencia, observaciones, estado)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(tienda_id, fecha || new Date().toISOString().slice(0, 10), req.user.id,
           Number(efectivo) || 0, Number(yape) || 0, Number(tarjeta) || 0, Number(transferencia) || 0,
           observaciones || null, estado || 'entregado');
    const cierreId = r.lastInsertRowid;
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

  const actualizar = db.transaction(() => {
    db.prepare(`
      UPDATE cierres_caja SET tienda_id=?, fecha=?, efectivo=?, yape=?, tarjeta=?, transferencia=?, observaciones=?, estado=?
      WHERE id=?
    `).run(p.tienda_id, p.fecha, Number(p.efectivo) || 0, Number(p.yape) || 0,
           Number(p.tarjeta) || 0, Number(p.transferencia) || 0, p.observaciones || null,
           p.estado || 'entregado', req.params.id);
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
