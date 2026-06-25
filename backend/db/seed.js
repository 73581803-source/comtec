// Seed inicial con datos demo para ComTec
const bcrypt = require('bcryptjs');
const db = require('./database');

const has = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c > 0;

if (has('users')) {
  console.log('[seed] La base ya tiene datos. Saltando seed.');
  process.exit(0);
}

console.log('[seed] Sembrando datos demo…');

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

// ---------- Usuarios ----------
const insertUser = db.prepare(`
  INSERT INTO users (nombre, email, password_hash, role, telefono)
  VALUES (@nombre, @email, @hash, @role, @telefono)
`);

const usuarios = [
  { nombre: 'Administrador ComTec', email: 'admin@comtec.pe',     hash: hash('admin123'),    role: 'admin',    telefono: '964000000' },
  { nombre: 'María Quispe',         email: 'maria@comtec.pe',     hash: hash('vendedor123'), role: 'vendedor', telefono: '964111111' },
  { nombre: 'Luz Hilario',          email: 'luz@comtec.pe',       hash: hash('vendedor123'), role: 'vendedor', telefono: '964222222' },
  { nombre: 'Carlos Ramos',         email: 'carlos@comtec.pe',    hash: hash('tecnico123'),  role: 'tecnico',  telefono: '964333333' },
  { nombre: 'Jorge Lazo',           email: 'jorge@comtec.pe',     hash: hash('tecnico123'),  role: 'tecnico',  telefono: '964444444' },
];
const userIds = {};
for (const u of usuarios) {
  const r = insertUser.run(u);
  userIds[u.email] = r.lastInsertRowid;
}

// ---------- Tiendas / sucursales ----------
const insertTienda = db.prepare('INSERT INTO tiendas (nombre, direccion) VALUES (?, ?)');
const tiendasSeed = [
  ['Tienda Centro',   'Av. Principal 123'],
  ['Tienda Mercado',  'Jr. Comercio 456'],
  ['Tienda Norte',    null],
];
const tiendaIds = tiendasSeed.map(([n, d]) => insertTienda.run(n, d).lastInsertRowid);

// ---------- Inventario ----------
const insertInv = db.prepare(`
  INSERT INTO inventory (sku, nombre, categoria, marca, descripcion, precio_compra, precio_venta, stock, stock_min, imagen_url, tienda_id)
  VALUES (@sku, @nombre, @categoria, @marca, @descripcion, @pc, @pv, @stock, @stockMin, @img, @tienda)
`);

const productos = [
  // Laptops
  { sku:'LAP-001', nombre:'Laptop HP Pavilion 15 i5 12va 16GB 512SSD', categoria:'laptops',    marca:'HP',      descripcion:'15.6" FHD, Intel Core i5-1235U, 16GB DDR4, 512GB NVMe', pc:2400, pv:2899, stock:8,  stockMin:2, img:'' },
  { sku:'LAP-002', nombre:'Laptop Lenovo IdeaPad 3 Ryzen 5 8GB 256SSD', categoria:'laptops',   marca:'Lenovo',  descripcion:'AMD Ryzen 5 5500U, 8GB, 256GB SSD',                       pc:1700, pv:2099, stock:6,  stockMin:2, img:'' },
  { sku:'LAP-003', nombre:'Laptop Asus TUF Gaming F15 i7 RTX3050',     categoria:'laptops',   marca:'Asus',    descripcion:'Gaming i7-12700H, RTX 3050, 16GB, 512GB',                  pc:3700, pv:4499, stock:4,  stockMin:1, img:'' },
  { sku:'LAP-004', nombre:'Laptop Acer Aspire 5 i3 8GB 256SSD',         categoria:'laptops',   marca:'Acer',    descripcion:'Intel Core i3-1215U, 8GB, 256GB',                          pc:1500, pv:1849, stock:10, stockMin:2, img:'' },
  // Desktops
  { sku:'PC-001',  nombre:'PC Gamer Ryzen 5 5500 / 16GB / RTX 3060 / 1TB', categoria:'desktops', marca:'ComTec', descripcion:'Equipo ensamblado en tienda, garantía 1 año',           pc:3200, pv:3899, stock:3,  stockMin:1, img:'' },
  { sku:'PC-002',  nombre:'PC Oficina Intel i5 12va / 16GB / 512SSD',     categoria:'desktops',  marca:'ComTec', descripcion:'Equipo ensamblado, perfecto para oficina',              pc:1900, pv:2299, stock:5,  stockMin:1, img:'' },
  { sku:'PC-003',  nombre:'PC Workstation Ryzen 7 / 32GB / 1TB NVMe',      categoria:'desktops',  marca:'ComTec', descripcion:'Equipo profesional para diseño/render',                pc:3700, pv:4499, stock:2,  stockMin:1, img:'' },
  // Impresoras
  { sku:'IMP-001', nombre:'Impresora Epson EcoTank L3250 multifuncional', categoria:'impresoras',marca:'Epson',  descripcion:'WiFi, tanque de tinta, copia/escanea',                  pc:680,  pv:849,  stock:7,  stockMin:2, img:'' },
  { sku:'IMP-002', nombre:'Impresora HP DeskJet 2775 Wifi',               categoria:'impresoras',marca:'HP',     descripcion:'Imprime, escanea y copia',                              pc:380,  pv:489,  stock:6,  stockMin:2, img:'' },
  // Monitores
  { sku:'MON-001', nombre:'Monitor LG 24" Full HD IPS 75Hz',              categoria:'monitores', marca:'LG',     descripcion:'24MK430H, IPS, HDMI/VGA',                                pc:550,  pv:699,  stock:9,  stockMin:2, img:'' },
  { sku:'MON-002', nombre:'Monitor Samsung Curvo 27" 144Hz',              categoria:'monitores', marca:'Samsung',descripcion:'LC27RG50, FreeSync, ideal gaming',                       pc:980,  pv:1199, stock:4,  stockMin:1, img:'' },
  // Componentes
  { sku:'CPU-001', nombre:'Procesador AMD Ryzen 5 5600 6 núcleos',        categoria:'componentes',marca:'AMD',   descripcion:'AM4, 6c/12t, 3.5GHz boost 4.4GHz',                        pc:480,  pv:599,  stock:12, stockMin:3, img:'' },
  { sku:'CPU-002', nombre:'Procesador Intel Core i5-12400F',              categoria:'componentes',marca:'Intel', descripcion:'LGA1700, 6c/12t, sin gráficos',                          pc:580,  pv:699,  stock:8,  stockMin:2, img:'' },
  { sku:'GPU-001', nombre:'Tarjeta gráfica RTX 3060 12GB',                 categoria:'componentes',marca:'NVIDIA', descripcion:'12GB GDDR6, ideal 1080p/1440p',                         pc:1450, pv:1799, stock:5,  stockMin:1, img:'' },
  { sku:'RAM-001', nombre:'Memoria RAM Kingston Fury 16GB DDR4 3200',     categoria:'componentes',marca:'Kingston',descripcion:'2x8GB CL16',                                            pc:200,  pv:259,  stock:20, stockMin:5, img:'' },
  { sku:'SSD-001', nombre:'SSD NVMe Kingston NV2 500GB',                   categoria:'componentes',marca:'Kingston',descripcion:'M.2 2280, hasta 3500MB/s',                              pc:160,  pv:209,  stock:18, stockMin:4, img:'' },
  { sku:'SSD-002', nombre:'SSD NVMe Western Digital SN770 1TB',           categoria:'componentes',marca:'WD',    descripcion:'M.2 2280, hasta 5150MB/s',                                pc:310,  pv:399,  stock:10, stockMin:3, img:'' },
  { sku:'PSU-001', nombre:'Fuente Cooler Master 600W 80+ Bronze',         categoria:'componentes',marca:'Cooler Master',descripcion:'MWE Bronze V2',                                    pc:200,  pv:259,  stock:9,  stockMin:2, img:'' },
  // Accesorios
  { sku:'ACC-001', nombre:'Teclado mecánico Redragon Kumara K552',        categoria:'accesorios', marca:'Redragon',descripcion:'Switch outemu, retroiluminación',                     pc:140,  pv:189,  stock:15, stockMin:4, img:'' },
  { sku:'ACC-002', nombre:'Mouse Logitech G203 Lightsync',                categoria:'accesorios', marca:'Logitech',descripcion:'8000 DPI, RGB',                                         pc:90,   pv:129,  stock:20, stockMin:5, img:'' },
];

productos.forEach((p, i) => insertInv.run({ ...p, tienda: tiendaIds[i % tiendaIds.length] }));
const allInvIds = db.prepare('SELECT id, sku FROM inventory').all();

// ---------- Componentes destacados (los que aparecerán en la home) ----------
const featured = ['CPU-001','CPU-002','GPU-001','RAM-001','SSD-002','PSU-001'];
const insertFeat = db.prepare('INSERT INTO components_featured (inventory_id, orden, destacado, etiqueta) VALUES (?,?,?,?)');
featured.forEach((sku, i) => {
  const row = allInvIds.find(r => r.sku === sku);
  if (row) insertFeat.run(row.id, i, 1, i < 2 ? 'OFERTA' : null);
});

// ---------- Ventas demo (últimos 60 días) ----------
const insertSale = db.prepare(`
  INSERT INTO sales (boleta_numero, fecha, vendedor_id, cliente_nombre, cliente_dni, subtotal, igv, total, metodo_pago)
  VALUES (@boleta, @fecha, @vendedor, @cliente, @dni, @sub, @igv, @total, @metodo)
`);
const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (sale_id, inventory_id, descripcion, cantidad, precio_unit, subtotal)
  VALUES (?,?,?,?,?,?)
`);

const vendedores = [userIds['maria@comtec.pe'], userIds['luz@comtec.pe']];
const metodos = ['efectivo','yape','plin','tarjeta','transferencia'];
const clientes = [
  ['Juan Pérez','45123987'], ['Rosa Huamán','41789654'], ['Pedro Castro','70123456'],
  ['Ana Salinas','46789321'], ['Luis Vega','42135987'], ['Diana Soto','71456789'],
  ['Marco Lazo','40987123'], ['Sofía Mendoza','43217896'], ['Hugo Quispe','45678912'],
  ['Cliente boleta','—'],
];

const today = new Date();
let boletaSeq = 1001;

for (let d = 60; d >= 0; d--) {
  // 0-2 ventas por día, más densas en los últimos días
  const ventasDia = Math.floor(Math.random() * (d < 14 ? 3 : 2)) + (d % 4 === 0 ? 1 : 0);
  for (let n = 0; n < ventasDia; n++) {
    const fecha = new Date(today);
    fecha.setDate(today.getDate() - d);
    fecha.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
    const fechaIso = fecha.toISOString().slice(0, 19).replace('T', ' ');

    const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
    const [cliNombre, cliDni] = clientes[Math.floor(Math.random() * clientes.length)];
    const metodo = metodos[Math.floor(Math.random() * metodos.length)];

    // 1 a 3 productos
    const items = [];
    const nItems = 1 + Math.floor(Math.random() * 3);
    const usados = new Set();
    for (let i = 0; i < nItems; i++) {
      let prod;
      do { prod = allInvIds[Math.floor(Math.random() * allInvIds.length)]; } while (usados.has(prod.id));
      usados.add(prod.id);
      const cant = 1 + Math.floor(Math.random() * 2);
      const inv = db.prepare('SELECT precio_venta, nombre FROM inventory WHERE id = ?').get(prod.id);
      const precio = inv.precio_venta;
      items.push({ id: prod.id, nombre: inv.nombre, cant, precio, sub: precio * cant });
    }
    const sub = items.reduce((s, it) => s + it.sub, 0);
    const igv = +(sub * 0.18).toFixed(2);
    const total = +(sub + igv).toFixed(2);

    const saleRes = insertSale.run({
      boleta: 'B001-' + String(boletaSeq++).padStart(6, '0'),
      fecha: fechaIso,
      vendedor,
      cliente: cliNombre,
      dni: cliDni === '—' ? null : cliDni,
      sub: +sub.toFixed(2), igv, total,
      metodo,
    });
    for (const it of items) {
      insertSaleItem.run(saleRes.lastInsertRowid, it.id, it.nombre, it.cant, it.precio, +it.sub.toFixed(2));
    }
  }
}

// ---------- Logs de técnicos demo ----------
const insertTechLog = db.prepare(`
  INSERT INTO tech_logs (tecnico_id, fecha, cliente, equipo, descripcion, monto, estado, fuente)
  VALUES (?,?,?,?,?,?,?,?)
`);
const trabajos = [
  ['Mantenimiento general + limpieza','Laptop HP'],
  ['Cambio de pantalla 15.6"','Laptop Lenovo'],
  ['Reinstalación de Windows + drivers','PC oficina'],
  ['Cambio de teclado','Laptop Asus'],
  ['Recuperación de datos disco dañado','Disco externo'],
  ['Instalación de SSD + clonado','Laptop Acer'],
  ['Reparación de fuente de poder','PC gamer'],
  ['Diagnóstico de placa','PC ensamblado'],
];
const tecnicos = [userIds['carlos@comtec.pe'], userIds['jorge@comtec.pe']];

for (let d = 45; d >= 0; d--) {
  const trabajosDia = Math.floor(Math.random() * 3);
  for (let n = 0; n < trabajosDia; n++) {
    const fecha = new Date(today);
    fecha.setDate(today.getDate() - d);
    const fechaIso = fecha.toISOString().slice(0, 10);
    const t = trabajos[Math.floor(Math.random() * trabajos.length)];
    insertTechLog.run(
      tecnicos[Math.floor(Math.random() * tecnicos.length)],
      fechaIso,
      clientes[Math.floor(Math.random() * clientes.length)][0],
      t[1],
      t[0],
      40 + Math.floor(Math.random() * 280),
      'completado',
      'manual'
    );
  }
}

// ---------- Cierres de caja demo (últimos 15 días) ----------
const insertCierre = db.prepare(`
  INSERT INTO cierres_caja (tienda_id, fecha, usuario_id, efectivo, yape, tarjeta, transferencia, observaciones, estado)
  VALUES (?,?,?,?,?,?,?,?,?)
`);
const insertEgreso = db.prepare('INSERT INTO cierre_egresos (cierre_id, concepto, proveedor, monto) VALUES (?,?,?,?)');
const responsables = [userIds['maria@comtec.pe'], userIds['luz@comtec.pe']];
const proveedores = ['Distribuidora Tech SAC', 'Importaciones Lima', 'Mayorista Wilson', 'ProveeStock EIRL'];

for (let d = 15; d >= 1; d--) {
  for (const tid of tiendaIds) {
    if (Math.random() < 0.15) continue; // a veces una tienda no entrega ese día
    const fecha = new Date(today);
    fecha.setDate(today.getDate() - d);
    const fechaIso = fecha.toISOString().slice(0, 10);
    const efectivo = 200 + Math.floor(Math.random() * 1400);
    const yape = Math.floor(Math.random() * 900);
    const tarjeta = Math.random() < 0.5 ? Math.floor(Math.random() * 600) : 0;
    const transferencia = Math.random() < 0.3 ? Math.floor(Math.random() * 500) : 0;
    const r = insertCierre.run(tid, fechaIso, responsables[Math.floor(Math.random() * responsables.length)],
      efectivo, yape, tarjeta, transferencia, null, 'entregado');
    // 0 a 2 pagos a proveedor
    const nEg = Math.floor(Math.random() * 3);
    for (let k = 0; k < nEg; k++) {
      insertEgreso.run(r.lastInsertRowid, 'Compra de mercadería',
        proveedores[Math.floor(Math.random() * proveedores.length)],
        50 + Math.floor(Math.random() * 450));
    }
  }
}

// ---------- Mensajes de chat de bienvenida ----------
const insertMsg = db.prepare('INSERT INTO chat_messages (user_id, sala, mensaje, creado_en) VALUES (?,?,?,?)');
const ahora = new Date();
const ago = (mins) => new Date(ahora.getTime() - mins * 60000).toISOString().slice(0, 19).replace('T', ' ');
insertMsg.run(userIds['admin@comtec.pe'],  'general', '¡Bienvenidos al chat interno de ComTec! 👋', ago(120));
insertMsg.run(userIds['maria@comtec.pe'],  'general', 'Hola a todos, listas para empezar el día.', ago(115));
insertMsg.run(userIds['carlos@comtec.pe'], 'general', 'Buen día, voy a recoger los equipos de servicio.', ago(60));
insertMsg.run(userIds['admin@comtec.pe'],  'admin',   'Reunión de cierre de mes el viernes 9am.', ago(30));

console.log('[seed] ✔ Datos demo creados.');
console.log('[seed]   Total usuarios: ', db.prepare('SELECT COUNT(*) c FROM users').get().c);
console.log('[seed]   Total productos:', db.prepare('SELECT COUNT(*) c FROM inventory').get().c);
console.log('[seed]   Total ventas:   ', db.prepare('SELECT COUNT(*) c FROM sales').get().c);
console.log('[seed]   Total trab. téc:', db.prepare('SELECT COUNT(*) c FROM tech_logs').get().c);
console.log('');
console.log('Credenciales demo:');
console.log('  Admin:     admin@comtec.pe / admin123');
console.log('  Vendedor:  maria@comtec.pe / vendedor123');
console.log('  Vendedor:  luz@comtec.pe   / vendedor123');
console.log('  Técnico:   carlos@comtec.pe / tecnico123');
console.log('  Técnico:   jorge@comtec.pe  / tecnico123');
