const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'comtec-dev-secret';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, nombre: user.nombre, email: user.email },
    SECRET,
    { expiresIn: '12h' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permiso denegado para tu rol' });
    }
    next();
  };
}

function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch (e) { return null; }
}

module.exports = { signToken, authRequired, requireRole, verifyToken };
