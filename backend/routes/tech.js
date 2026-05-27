const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/logs', (req, res) => {
  const { tecnicoId, desde, hasta } = req.query;
  let sql = `
    SELECT t.*, u.nombre AS tecnico_nombre
    FROM tech_logs t JOIN users u ON u.id = t.tecnico_id WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'tecnico') { sql += ' AND t.tecnico_id = ?'; params.push(req.user.id); }
  else if (tecnicoId) { sql += ' AND t.tecnico_id = ?'; params.push(tecnicoId); }
  if (desde) { sql += ' AND t.fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND t.fecha <= ?'; params.push(hasta); }
  sql += ' ORDER BY t.fecha DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.post('/logs', requireRole('admin','tecnico'), (req, res) => {
  const { cliente, equipo, descripcion, monto, estado, tecnico_id, fecha } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'descripcion requerida' });
  const tid = req.user.role === 'tecnico' ? req.user.id : (tecnico_id || req.user.id);
  const r = db.prepare(`
    INSERT INTO tech_logs (tecnico_id, fecha, cliente, equipo, descripcion, monto, estado, fuente)
    VALUES (?,?,?,?,?,?,?, 'manual')
  `).run(tid, fecha || new Date().toISOString().slice(0,10),
         cliente || null, equipo || null, descripcion,
         Number(monto) || 0, estado || 'completado');
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/logs/:id', requireRole('admin','tecnico'), (req, res) => {
  const cur = db.prepare('SELECT * FROM tech_logs WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role === 'tecnico' && cur.tecnico_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });
  const p = { ...cur, ...req.body };
  db.prepare('UPDATE tech_logs SET cliente=?, equipo=?, descripcion=?, monto=?, estado=?, fecha=? WHERE id=?')
    .run(p.cliente, p.equipo, p.descripcion, Number(p.monto), p.estado, p.fecha, req.params.id);
  res.json({ ok: true });
});

router.delete('/logs/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM tech_logs WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/resumen/:id', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role === 'tecnico' && req.user.id !== id) return res.status(403).json({ error: 'Sin permiso' });
  const total = db.prepare("SELECT COUNT(*) AS trabajos, COALESCE(SUM(monto),0) AS ingresos FROM tech_logs WHERE tecnico_id = ? AND estado != 'cancelado'").get(id);
  const mes = db.prepare(`
    SELECT COUNT(*) AS trabajos, COALESCE(SUM(monto),0) AS ingresos
    FROM tech_logs WHERE tecnico_id = ? AND estado != 'cancelado'
      AND strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
  `).get(id);
  const porDia = db.prepare(`
    SELECT fecha AS dia, COUNT(*) AS trabajos, SUM(monto) AS ingresos
    FROM tech_logs WHERE tecnico_id = ? AND fecha >= date('now','-30 day') AND estado != 'cancelado'
    GROUP BY fecha ORDER BY fecha
  `).all(id);
  res.json({ total, mes, porDia });
});

module.exports = router;
