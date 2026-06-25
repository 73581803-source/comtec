// Wrapper sobre node:sqlite (built-in en Node 22.5+) que expone una API
// compatible con la que veníamos usando: prepare(), exec(), transaction(), pragma().
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'comtec.db');
const raw = new DatabaseSync(dbPath);

raw.exec('PRAGMA journal_mode = WAL;');
raw.exec('PRAGMA foreign_keys = ON;');

const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  raw.exec(fs.readFileSync(schemaPath, 'utf8'));
}

// ---- Migraciones idempotentes (para bases creadas antes de cambios) ----
function ensureColumn(table, column, definition) {
  const cols = raw.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
try {
  ensureColumn('sales',      'tipo',         "TEXT NOT NULL DEFAULT 'boleta'");
  ensureColumn('sales',      'valido_hasta', "TEXT");
  ensureColumn('sale_items', 'es_externo',   "INTEGER NOT NULL DEFAULT 0");
  raw.exec('CREATE INDEX IF NOT EXISTS idx_sales_tipo ON sales(tipo)');
  // Inventario por tienda: cada producto puede estar asignado a una sucursal
  ensureColumn('inventory',  'tienda_id',    "INTEGER");
  raw.exec('CREATE INDEX IF NOT EXISTS idx_inventory_tienda ON inventory(tienda_id)');
  // Garantiza al menos una tienda para bases ya existentes (Render, etc.)
  const hayTiendas = raw.prepare('SELECT COUNT(*) AS c FROM tiendas').get().c;
  if (!hayTiendas) {
    const ins = raw.prepare('INSERT INTO tiendas (nombre, direccion) VALUES (?, ?)');
    ins.run('Tienda 1', null);
    ins.run('Tienda 2', null);
  }
} catch (e) {
  console.warn('[db] migración:', e.message);
}

function toNum(v) { return typeof v === 'bigint' ? Number(v) : v; }

function wrapStmt(stmt) {
  function normalize(args) {
    // si es un solo objeto (parámetros nombrados), node:sqlite acepta {clave: valor}
    return args;
  }
  return {
    run(...args) {
      const r = stmt.run(...normalize(args));
      return { changes: toNum(r.changes), lastInsertRowid: toNum(r.lastInsertRowid) };
    },
    get(...args) {
      return stmt.get(...normalize(args));
    },
    all(...args) {
      return stmt.all(...normalize(args));
    },
  };
}

function transaction(fn) {
  return function (...args) {
    raw.exec('BEGIN');
    try {
      const result = fn(...args);
      raw.exec('COMMIT');
      return result;
    } catch (e) {
      try { raw.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  };
}

const db = {
  prepare: (sql) => wrapStmt(raw.prepare(sql)),
  exec:    (sql) => raw.exec(sql),
  transaction,
  pragma:  () => {}, // no-op para compatibilidad
  _raw:    raw,
};

module.exports = db;
