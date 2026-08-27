// db.js
// PostgreSQL-backed database layer for production persistence.
// Creates tables if they do not exist and seeds the admin user + default data.

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

function resolveDbConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'lms',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  };
}

function normalizeQuery(sql, params = []) {
  let index = 0;
  const text = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  return { text, values: params };
}

const config = resolveDbConfig();

if (config.connectionString) {
  config.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err);
});

async function run(sql, params = []) {
  const queryText = /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)
    ? `${sql.trim()} RETURNING id`
    : sql;

  const { text, values } = normalizeQuery(queryText, params);
  const result = await pool.query(text, values);

  return {
    lastInsertRowid: result.rows[0]?.id ?? null,
    changes: result.rowCount ?? 0,
  };
}

async function get(sql, params = []) {
  const { text, values } = normalizeQuery(sql, params);
  const result = await pool.query(text, values);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const { text, values } = normalizeQuery(sql, params);
  const result = await pool.query(text, values);
  return result.rows;
}

async function exec(sql) {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

// ---------- SCHEMA ----------
const ready = (async () => {
  await exec(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  active SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  lead_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  service_required VARCHAR(100) NOT NULL,
  lead_source VARCHAR(100) NOT NULL,
  estimated_value NUMERIC(12, 2),
  assigned_to VARCHAR(255) NOT NULL,
  remarks TEXT,
  lead_status VARCHAR(50) NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  followup_date TIMESTAMPTZ NOT NULL,
  followup_type VARCHAR(50) NOT NULL,
  remarks TEXT,
  next_followup_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_mobile ON leads(mobile);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_service ON leads(service_required);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON followups(lead_id);
`);

  // Ensure admin user exists and has the correct password from environment variables
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const hash = bcrypt.hashSync(password, 10);
  
  const existingAdmin = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existingAdmin) {
    // Update existing admin user with the correct password from env
    await run('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username]);
    console.log(`Updated admin user password: ${username}`);
  } else {
    // Insert new admin user if it doesn't exist
    await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'admin']);
    console.log(`Seeded admin user: ${username}`);
  }

  // Ensure default assignees are seeded
  const assigneeResult = await get('SELECT COUNT(*) AS c FROM assignees WHERE active = 1');
  const activeAssigneeCount = assigneeResult?.c || 0;
  
  if (activeAssigneeCount === 0) {
    try {
      const names = ['Unassigned', 'Rahul Sharma', 'Priya Nair', 'Amit Verma', 'Sara Khan'];
      for (const name of names) {
        await run('INSERT INTO assignees (name, active) VALUES (?, ?)', [name, 1]);
      }
      console.log(`✓ Seeded ${names.length} default assignees`);
    } catch (err) {
      console.error('Error seeding assignees:', err.message);
      // Assignees may already exist but be inactive; try to activate them
      await pool.query('UPDATE assignees SET active = 1');
      console.log('✓ Activated existing assignees');
    }
  } else {
    console.log(`✓ Found ${activeAssigneeCount} active assignees`);
  }
})();

module.exports = {
  resolveDbConfig,
  ready,
  run: (...args) => ready.then(() => run(...args)),
  get: (...args) => ready.then(() => get(...args)),
  all: (...args) => ready.then(() => all(...args)),
  exec: (...args) => ready.then(() => exec(...args)),
};
