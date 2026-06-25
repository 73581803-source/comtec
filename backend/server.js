require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const componentsRoutes = require('./routes/components');
const usersRoutes = require('./routes/users');
const techRoutes = require('./routes/tech');
const { router: chatRoutes, puedeVerSala, SALAS_PERMITIDAS } = require('./routes/chat');
const dashboardRoutes = require('./routes/dashboard');
const pdfRoutes = require('./routes/pdf');
const tiendasRoutes = require('./routes/tiendas');
const cajaRoutes = require('./routes/caja');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/sales',      salesRoutes);
app.use('/api/components', componentsRoutes);
app.use('/api/users',      usersRoutes);
app.use('/api/tech',       techRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/pdf',        pdfRoutes);
app.use('/api/tiendas',    tiendasRoutes);
app.use('/api/caja',       cajaRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Estáticos: sirve comtec-html
const STATIC_ROOT = path.join(__dirname, '..');
app.use(express.static(STATIC_ROOT, { index: 'index.html' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

// -------- Socket.io para chat --------
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Sin token'));
  const payload = verifyToken(token);
  if (!payload) return next(new Error('Token inválido'));
  socket.user = payload;
  next();
});

io.on('connection', (socket) => {
  const u = socket.user;

  // Unirse a las salas permitidas
  for (const sala of SALAS_PERMITIDAS) {
    if (puedeVerSala(u, sala)) socket.join(`sala:${sala}`);
  }
  socket.emit('chat:bienvenida', { user: u, salas: SALAS_PERMITIDAS.filter(s => puedeVerSala(u, s)) });

  socket.on('chat:enviar', ({ sala, mensaje }) => {
    if (!SALAS_PERMITIDAS.includes(sala)) return;
    if (!puedeVerSala(u, sala)) return;
    const texto = String(mensaje || '').trim();
    if (!texto) return;
    if (texto.length > 1000) return;
    const r = db.prepare('INSERT INTO chat_messages (user_id, sala, mensaje) VALUES (?,?,?)').run(u.id, sala, texto);
    const row = db.prepare(`
      SELECT m.id, m.user_id, m.sala, m.mensaje, m.creado_en, u.nombre AS user_nombre, u.role AS user_role
      FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `).get(r.lastInsertRowid);
    io.to(`sala:${sala}`).emit('chat:mensaje', row);
  });

  socket.on('chat:escribiendo', ({ sala }) => {
    if (!puedeVerSala(u, sala)) return;
    socket.to(`sala:${sala}`).emit('chat:escribiendo', { user_id: u.id, nombre: u.nombre });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  ComTec Backend corriendo                      ║');
  console.log(`║  http://localhost:${PORT}                          ║`);
  console.log('║  Login:    /login.html                         ║');
  console.log('║  Dashboard:/dashboard.html                     ║');
  console.log('║  API:      /api                                ║');
  console.log('╚════════════════════════════════════════════════╝');
});
