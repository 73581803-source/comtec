const express = require('express');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// KPIs y datos para gráficos
router.get('/stats', (req, res) => {
  const hoy = db.prepare(`
    SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS monto
    FROM sales WHERE DATE(fecha) = DATE('now') AND estado != 'anulada'
  `).get();
  const mes = db.prepare(`
    SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS monto
    FROM sales WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now') AND estado != 'anulada'
  `).get();
  const totalProductos = db.prepare("SELECT COUNT(*) AS c FROM inventory WHERE activo=1").get().c;
  const bajoStock = db.prepare("SELECT COUNT(*) AS c FROM inventory WHERE activo=1 AND stock <= stock_min").get().c;
  const totalUsuarios = db.prepare("SELECT COUNT(*) AS c FROM users WHERE activo=1").get().c;
  const ingresosTecMes = db.prepare(`
    SELECT COALESCE(SUM(monto),0) AS monto
    FROM tech_logs WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now') AND estado != 'cancelado'
  `).get().monto;

  // Ventas por día últimos 30
  const ventasPorDia = db.prepare(`
    SELECT DATE(fecha) AS dia, COUNT(*) AS ventas, COALESCE(SUM(total),0) AS monto
    FROM sales WHERE fecha >= datetime('now','-30 day') AND estado != 'anulada'
    GROUP BY DATE(fecha) ORDER BY dia
  `).all();

  // Ventas por categoría (mes actual)
  const ventasPorCategoria = db.prepare(`
    SELECT i.categoria, COALESCE(SUM(si.subtotal),0) AS monto, SUM(si.cantidad) AS unidades
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN inventory i ON i.id = si.inventory_id
    WHERE s.estado != 'anulada' AND strftime('%Y-%m', s.fecha) = strftime('%Y-%m','now')
      AND i.categoria IS NOT NULL
    GROUP BY i.categoria ORDER BY monto DESC
  `).all();

  // Ranking de vendedores (mes)
  const topVendedores = db.prepare(`
    SELECT u.id, u.nombre, COUNT(*) AS ventas, COALESCE(SUM(s.total),0) AS monto
    FROM sales s JOIN users u ON u.id = s.vendedor_id
    WHERE strftime('%Y-%m', s.fecha) = strftime('%Y-%m','now') AND s.estado != 'anulada'
    GROUP BY u.id ORDER BY monto DESC
  `).all();

  // Top productos
  const topProductos = db.prepare(`
    SELECT i.id, i.nombre, i.categoria, SUM(si.cantidad) AS unidades, SUM(si.subtotal) AS monto
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN inventory i ON i.id = si.inventory_id
    WHERE s.estado != 'anulada' AND s.fecha >= datetime('now','-30 day')
    GROUP BY i.id ORDER BY unidades DESC LIMIT 8
  `).all();

  // Métodos de pago
  const metodos = db.prepare(`
    SELECT metodo_pago, COUNT(*) AS ventas, SUM(total) AS monto
    FROM sales WHERE estado != 'anulada' AND strftime('%Y-%m', fecha) = strftime('%Y-%m','now')
    GROUP BY metodo_pago ORDER BY monto DESC
  `).all();

  res.json({
    kpis: {
      ventasHoy: hoy.ventas, montoHoy: hoy.monto,
      ventasMes: mes.ventas, montoMes: mes.monto,
      totalProductos, bajoStock, totalUsuarios, ingresosTecMes,
    },
    ventasPorDia, ventasPorCategoria, topVendedores, topProductos, metodos,
  });
});

module.exports = router;
