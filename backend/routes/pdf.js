/**
 * Generación de PDF server-side para boleta / proforma / nota_venta.
 * Endpoint: GET /api/pdf/sale/:id
 * Devuelve el archivo PDF como stream (Content-Type: application/pdf).
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const COLOR = {
  brand:     '#1e329c',
  brandDark: '#182879',
  cyan:      '#008dde',
  line:      '#e3e7f1',
  text:      '#0f172a',
  text2:     '#475569',
  surface2:  '#f8fafc',
};

const EMPRESA = {
  nombre:    'ComTec',
  lema:      'Tu tienda de tecnología en Huancayo',
  ruc:       '20XXXXXXXXX',
  direccion: 'Av. Real 123, Huancayo - Junín',
  telefono:  '964 000 000',
  email:     'ventas@comtec.pe',
  web:       'https://comtec-ds64.onrender.com',
};

const TITULO = {
  boleta:     'Boleta de venta',
  proforma:   'Proforma / Cotización',
  nota_venta: 'Nota de venta (interno)',
};

const LEYENDA = {
  boleta:     'Gracias por su compra. Conserve este comprobante. Cambios y devoluciones según política de la tienda.',
  proforma:   'Este documento es una cotización y NO constituye comprobante de pago. Los precios y disponibilidad están sujetos a confirmación dentro del período de validez.',
  nota_venta: 'USO INTERNO. Este documento no es un comprobante de pago oficial.',
};

function money(v) {
  const n = Number(v) || 0;
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtFechaCorta(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}

router.get('/sale/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, u.nombre AS vendedor_nombre
    FROM sales s JOIN users u ON u.id = s.vendedor_id WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.role === 'vendedor' && sale.vendedor_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(req.params.id);
  const tipo = sale.tipo || 'boleta';
  const titulo = TITULO[tipo] || TITULO.boleta;
  const accent = tipo === 'proforma' ? COLOR.cyan : COLOR.brand;

  const filename = `${tipo.toUpperCase()}-${sale.boleta_numero || sale.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: titulo, Author: 'ComTec' } });
  doc.pipe(res);

  // ============ HEADER ============
  const logoPath = path.join(__dirname, '..', '..', 'images', 'logo.jpeg');
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 40, 32, { fit: [54, 54] }); } catch (e) { /* ignore */ }
  }

  // Empresa
  doc.fillColor(COLOR.brand).font('Helvetica-Bold').fontSize(20).text(EMPRESA.nombre, 105, 36);
  doc.fillColor(COLOR.text2).font('Helvetica').fontSize(9).text(EMPRESA.lema, 105, 58);
  doc.fontSize(8).text(
    `RUC: ${EMPRESA.ruc}    •    ${EMPRESA.direccion}    •    Tel: ${EMPRESA.telefono}`,
    105, 70, { width: 280 }
  );

  // Badge tipo de doc (esquina sup. derecha)
  doc.rect(400, 32, 155, 22).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10)
     .text(titulo.toUpperCase(), 400, 38, { width: 155, align: 'center' });

  // Número
  doc.fillColor(COLOR.brand).font('Helvetica-Bold').fontSize(15)
     .text(sale.boleta_numero || '', 400, 60, { width: 155, align: 'center' });

  // Fecha + validez
  doc.fillColor(COLOR.text2).font('Helvetica').fontSize(8)
     .text(`Fecha: ${fmtFecha(sale.fecha)}`, 400, 82, { width: 155, align: 'center' });
  if (tipo === 'proforma' && sale.valido_hasta) {
    doc.fillColor(COLOR.cyan).font('Helvetica-Bold').fontSize(8.5)
       .text(`Válida hasta: ${fmtFechaCorta(sale.valido_hasta)}`,
             400, 95, { width: 155, align: 'center' });
  }

  // Línea separadora
  doc.strokeColor(COLOR.line).lineWidth(1).moveTo(40, 115).lineTo(555, 115).stroke();

  // ============ CLIENTE ============
  let y = 130;
  doc.fillColor(COLOR.text).font('Helvetica-Bold').fontSize(10).text('Cliente', 40, y);
  y += 14;
  doc.fillColor(COLOR.text2).font('Helvetica').fontSize(10);
  let cli = sale.cliente_nombre || '';
  if (sale.cliente_dni) cli += `    •    DNI/RUC: ${sale.cliente_dni}`;
  if (sale.cliente_tel) cli += `    •    Tel: ${sale.cliente_tel}`;
  doc.text(cli, 40, y, { width: 515 });
  y += 14;
  doc.text(
    `Atendido por: ${sale.vendedor_nombre || ''}    •    Método de pago: ${(sale.metodo_pago || 'efectivo').toUpperCase()}`,
    40, y, { width: 515 }
  );
  y += 22;

  // ============ TABLA DE ITEMS ============
  // Cabecera
  doc.rect(40, y, 515, 22).fill(COLOR.surface2);
  doc.fillColor(COLOR.text2).font('Helvetica-Bold').fontSize(9);
  doc.text('PRODUCTO / SERVICIO', 50, y + 7, { width: 290 });
  doc.text('CANT.',     350, y + 7, { width: 40, align: 'center' });
  doc.text('P. UNIT.',  395, y + 7, { width: 70, align: 'right' });
  doc.text('SUBTOTAL',  470, y + 7, { width: 80, align: 'right' });
  y += 22;

  // Filas (NO se distingue inventario vs externo en el PDF — invisible al cliente)
  doc.fillColor(COLOR.text).font('Helvetica').fontSize(9.5);
  for (const it of items) {
    const descHeight = doc.heightOfString(it.descripcion || '', { width: 290 });
    const rowH = Math.max(20, descHeight + 10);
    if (y + rowH > 760) { doc.addPage(); y = 40; }

    doc.fillColor(COLOR.text).text(it.descripcion || '', 50, y + 5, { width: 290 });
    doc.text(String(it.cantidad), 350, y + 5, { width: 40, align: 'center' });
    doc.text(money(it.precio_unit), 395, y + 5, { width: 70, align: 'right' });
    doc.text(money(it.subtotal),    470, y + 5, { width: 80, align: 'right' });
    y += rowH;
    doc.strokeColor(COLOR.line).lineWidth(0.4).moveTo(40, y).lineTo(555, y).stroke();
  }

  // ============ TOTALES ============
  y += 14;
  doc.fillColor(COLOR.text2).font('Helvetica').fontSize(10);
  doc.text('Subtotal:', 400, y, { width: 65, align: 'right' });
  doc.fillColor(COLOR.text).text(money(sale.subtotal), 470, y, { width: 80, align: 'right' });
  y += 18;

  if (tipo !== 'nota_venta') {
    doc.fillColor(COLOR.text2).text('IGV (18%):', 400, y, { width: 65, align: 'right' });
    doc.fillColor(COLOR.text).text(money(sale.igv), 470, y, { width: 80, align: 'right' });
    y += 18;
  }

  // Caja del total
  y += 4;
  doc.rect(395, y, 160, 28).fillAndStroke(COLOR.brand, COLOR.brand);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11)
     .text('TOTAL', 400, y + 10, { width: 65, align: 'right' });
  doc.fontSize(15).text(money(sale.total), 460, y + 7, { width: 90, align: 'right' });
  y += 40;

  // ============ NOTAS ============
  if (sale.notas) {
    doc.fillColor(COLOR.text2).font('Helvetica-Oblique').fontSize(9)
       .text(`Notas: ${sale.notas}`, 40, y, { width: 515 });
    y = doc.y + 8;
  }

  // ============ LEYENDA ============
  if (y > 720) { doc.addPage(); y = 60; }
  doc.strokeColor(COLOR.line).lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
  y += 8;
  doc.fillColor(COLOR.text2).font('Helvetica-Oblique').fontSize(8.5)
     .text(LEYENDA[tipo] || '', 40, y, { width: 515 });

  // ============ FOOTER en cada página ============
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
       .text(`${EMPRESA.web}    •    ${EMPRESA.email}`, 40, 800, { width: 515, align: 'center' });
    doc.text(`Página ${i + 1} de ${range.count}`, 40, 812, { width: 515, align: 'center' });
  }

  doc.end();
});

module.exports = router;
