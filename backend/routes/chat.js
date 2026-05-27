const express = require('express');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const SALAS_PERMITIDAS = ['general', 'admin', 'tecnicos'];

function puedeVerSala(user, sala) {
  if (sala === 'general') return true;
  if (sala === 'admin') return user.role === 'admin';
  if (sala === 'tecnicos') return user.role === 'admin' || user.role === 'tecnico';
  return false;
}

router.get('/salas', (req, res) => {
  const salas = SALAS_PERMITIDAS.filter(s => puedeVerSala(req.user, s));
  res.json(salas.map(s => ({
    id: s,
    nombre: { general: 'General', admin: 'Admin', tecnicos: 'Técnicos' }[s]
  })));
});

router.get('/messages', (req, res) => {
  const sala = String(req.query.sala || 'general');
  if (!SALAS_PERMITIDAS.includes(sala)) return res.status(400).json({ error: 'Sala inválida' });
  if (!puedeVerSala(req.user, sala)) return res.status(403).json({ error: 'Sin permiso para la sala' });
  const rows = db.prepare(`
    SELECT m.id, m.user_id, m.sala, m.mensaje, m.creado_en, u.nombre AS user_nombre, u.role AS user_role
    FROM chat_messages m JOIN users u ON u.id = m.user_id
    WHERE m.sala = ? ORDER BY m.creado_en DESC LIMIT 100
  `).all(sala);
  res.json(rows.reverse());
});

module.exports = { router, puedeVerSala, SALAS_PERMITIDAS };
