-- ============================================================
-- ComTec — Esquema de base de datos
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','tecnico','vendedor')),
  telefono      TEXT,
  avatar_url    TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sku           TEXT UNIQUE,
  nombre        TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  marca         TEXT,
  descripcion   TEXT,
  precio_compra REAL NOT NULL DEFAULT 0,
  precio_venta  REAL NOT NULL DEFAULT 0,
  stock         INTEGER NOT NULL DEFAULT 0,
  stock_min     INTEGER NOT NULL DEFAULT 1,
  imagen_url    TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_cat ON inventory(categoria);
CREATE INDEX IF NOT EXISTS idx_inventory_activo ON inventory(activo);

CREATE TABLE IF NOT EXISTS components_featured (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL,
  orden        INTEGER NOT NULL DEFAULT 0,
  destacado    INTEGER NOT NULL DEFAULT 0,
  etiqueta     TEXT,
  creado_en    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  boleta_numero  TEXT UNIQUE,
  fecha          TEXT NOT NULL DEFAULT (datetime('now')),
  vendedor_id    INTEGER NOT NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_dni    TEXT,
  cliente_tel    TEXT,
  subtotal       REAL NOT NULL DEFAULT 0,
  igv            REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  metodo_pago    TEXT NOT NULL DEFAULT 'efectivo',
  estado         TEXT NOT NULL DEFAULT 'completada',
  notas          TEXT,
  FOREIGN KEY (vendedor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);
CREATE INDEX IF NOT EXISTS idx_sales_vendedor ON sales(vendedor_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id      INTEGER NOT NULL,
  inventory_id INTEGER,
  descripcion  TEXT NOT NULL,
  cantidad     INTEGER NOT NULL DEFAULT 1,
  precio_unit  REAL NOT NULL,
  subtotal     REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Registro de trabajos / ingresos de técnicos.
-- En el futuro se alimentará vía API desde el programa de cada técnico.
CREATE TABLE IF NOT EXISTS tech_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tecnico_id  INTEGER NOT NULL,
  fecha       TEXT NOT NULL DEFAULT (datetime('now')),
  cliente     TEXT,
  equipo      TEXT,
  descripcion TEXT NOT NULL,
  monto       REAL NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'completado',
  fuente      TEXT NOT NULL DEFAULT 'manual',  -- manual | api
  FOREIGN KEY (tecnico_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tech_logs_tecnico ON tech_logs(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_tech_logs_fecha ON tech_logs(fecha);

CREATE TABLE IF NOT EXISTS chat_messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  sala      TEXT NOT NULL DEFAULT 'general',  -- general | admin | tecnicos
  mensaje   TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_sala_fecha ON chat_messages(sala, creado_en);
