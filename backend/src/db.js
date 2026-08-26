// db.js
// Sets up a SQLite database (file-based, zero external server needed).
// Creates tables if they don't exist and seeds the admin user + reference data.

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'lms.sqlite');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const connection = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    connection.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

// ---------- SCHEMA ----------
const ready = (async () => {
  await exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  service_required TEXT NOT NULL,
  lead_source TEXT NOT NULL,
  estimated_value REAL,
  assigned_to TEXT NOT NULL,
  remarks TEXT,
  lead_status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  followup_date TEXT NOT NULL,
  followup_type TEXT NOT NULL,
  remarks TEXT,
  next_followup_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_service ON leads(service_required);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON followups(lead_id);
`);

  // ---------- SEED ----------
  const userCount = (await get('SELECT COUNT(*) AS c FROM users')).c;
  if (userCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';
    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'admin']);
    console.log(`Seeded admin user: ${username}`);
  }

  const assigneeCount = (await get('SELECT COUNT(*) AS c FROM assignees')).c;
  if (assigneeCount === 0) {
    const names = ['Unassigned', 'Rahul Sharma', 'Priya Nair', 'Amit Verma', 'Sara Khan'];
    for (const name of names) {
      await run('INSERT INTO assignees (name) VALUES (?)', [name]);
    }
    console.log('Seeded default assignees');
  }
})();

module.exports = {
  ready,
  run: (...args) => ready.then(() => run(...args)),
  get: (...args) => ready.then(() => get(...args)),
  all: (...args) => ready.then(() => all(...args)),
  exec: (...args) => ready.then(() => exec(...args)),
};
