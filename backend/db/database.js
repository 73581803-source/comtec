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
