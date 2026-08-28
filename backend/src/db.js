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
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
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

CREATE TABLE IF NOT EXISTS lead_notes (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note       TEXT    NOT NULL,
  created_by VARCHAR(255) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6366f1'
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE IF NOT EXISTS lead_attachments (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  file_name   VARCHAR(500) NOT NULL,
  file_size   INTEGER NOT NULL DEFAULT 0,
  file_type   VARCHAR(200) NOT NULL DEFAULT '',
  uploaded_by VARCHAR(255) NOT NULL DEFAULT 'admin',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activity (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,
  description TEXT        NOT NULL,
  actor       VARCHAR(255) NOT NULL DEFAULT 'admin',
  meta        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  filter_json TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username     ON users(username);
CREATE INDEX IF NOT EXISTS idx_leads_email        ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_mobile       ON leads(mobile);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_service      ON leads(service_required);
CREATE INDEX IF NOT EXISTS idx_leads_assigned     ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_lead     ON followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead    ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead     ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag      ON lead_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_lead_attach_lead   ON lead_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_time ON lead_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(created_by);

CREATE TABLE IF NOT EXISTS company_settings (
  id         SERIAL PRIMARY KEY,
  key        VARCHAR(100) UNIQUE NOT NULL,
  value      TEXT        NOT NULL DEFAULT '',
  updated_by VARCHAR(255) NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id         SERIAL PRIMARY KEY,
  slug       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  subject    VARCHAR(500) NOT NULL,
  body_html  TEXT        NOT NULL,
  body_text  TEXT        NOT NULL DEFAULT '',
  variables  TEXT        NOT NULL DEFAULT '[]',
  is_active  SMALLINT    NOT NULL DEFAULT 1,
  updated_by VARCHAR(255) NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_history (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username   VARCHAR(255) NOT NULL,
  ip_address VARCHAR(100) NOT NULL DEFAULT '',
  user_agent TEXT        NOT NULL DEFAULT '',
  status     VARCHAR(20) NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  actor       VARCHAR(255) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL DEFAULT '',
  entity_id   INTEGER,
  description TEXT        NOT NULL,
  ip_address  VARCHAR(100) NOT NULL DEFAULT '',
  meta        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_invites (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  role       VARCHAR(50)  NOT NULL DEFAULT 'staff',
  token      VARCHAR(255) UNIQUE NOT NULL,
  invited_by VARCHAR(255) NOT NULL DEFAULT 'admin',
  expires_at TIMESTAMPTZ NOT NULL,
  used       SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_settings_key ON company_settings(key);
CREATE INDEX IF NOT EXISTS idx_email_templates_slug  ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_login_history_user    ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time    ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time       ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prt_token             ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user              ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_evt_token             ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_token   ON staff_invites(token);
`);

  // Safe ALTER TABLE migrations — add new columns if they don't exist yet
  const safeAlters = [
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email          VARCHAR(255) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          VARCHAR(30)  NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT         NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active      SMALLINT     NOT NULL DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified SMALLINT     NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login     TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()`,
    // priority index must come AFTER the column exists
    `CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority)`,
  ];
  for (const stmt of safeAlters) {
    try { await pool.query(stmt); } catch (_) { /* column already exists */ }
  }

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

  // Ensure default assignees are seeded and active
  try {
    const countResult = await get('SELECT COUNT(*) AS c FROM assignees');
    const totalCount = Number(countResult?.c) || 0;
    console.log(`[DB-Seed] Total assignees in database: ${totalCount} (type: ${typeof totalCount})`);
    
    if (totalCount === 0) {
      // Table is completely empty - insert all defaults
      console.log('[DB-Seed] Seeding default assignees...');
      const defaults = ['Unassigned', 'Rahul Sharma', 'Priya Nair', 'Amit Verma', 'Sara Khan'];
      
      for (const name of defaults) {
        try {
          await pool.query(
            'INSERT INTO assignees (name, active) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
            [name, 1]
          );
          console.log(`[DB-Seed] Inserted: ${name}`);
        } catch (insertErr) {
          console.error(`[DB-Seed] Failed to insert ${name}:`, insertErr.message);
        }
      }
      
      const verifyResult = await get('SELECT COUNT(*) AS c FROM assignees');
      const verifyCount = Number(verifyResult?.c) || 0;
      console.log(`[DB-Seed] ✓ Seeding complete. Total assignees now: ${verifyCount}`);
    } else {
      // Table has data - activate any inactive ones
      console.log('[DB-Seed] Table has existing data. Ensuring all are active...');
      await pool.query('UPDATE assignees SET active = 1 WHERE active = 0');
      
      const activeResult = await get('SELECT COUNT(*) AS c FROM assignees WHERE active = 1');
      const activeCount = Number(activeResult?.c) || 0;
      console.log(`[DB-Seed] ✓ Found ${totalCount} total, ${activeCount} are now active`);
    }
  } catch (err) {
    console.error('[DB-Seed] ✗ ERROR:', err.message);
    // Don't throw - let the app continue with fallback values in meta endpoint
  }

  // Seed default tags
  try {
    const defaultTags = [
      { name: 'Hot Lead',   color: '#ef4444' },
      { name: 'Cold Lead',  color: '#3b82f6' },
      { name: 'VIP',        color: '#8b5cf6' },
      { name: 'Follow Up',  color: '#f59e0b' },
      { name: 'Enterprise', color: '#0891b2' },
    ];
    for (const t of defaultTags) {
      await pool.query(
        'INSERT INTO tags (name, color) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [t.name, t.color]
      );
    }
  } catch (err) {
    console.error('[DB-Seed] Tags seed error:', err.message);
  }

  // Seed default company settings
  try {
    const defaults = [
      ['company_name','LeadMS CRM'],['company_tagline','Manage every lead. Close every deal.'],
      ['company_email','admin@leadms.com'],['company_phone',''],['company_website',''],
      ['company_address',''],['company_logo_url',''],['company_favicon_url',''],
      ['primary_color','#4f46e5'],['accent_color','#f97316'],
      ['smtp_host',''],['smtp_port','587'],['smtp_user',''],['smtp_pass',''],
      ['smtp_from_name','LeadMS CRM'],['smtp_from_email','noreply@leadms.com'],['smtp_secure','false'],
      ['whatsapp_api_url',''],['whatsapp_token',''],['whatsapp_from',''],['whatsapp_enabled','false'],
      ['timezone','Asia/Kolkata'],['date_format','DD/MM/YYYY'],['currency','INR'],['currency_symbol','₹'],
      ['support_email','support@leadms.com'],['support_phone',''],
      ['allow_registration','false'],['require_email_verification','false'],['session_timeout_hours','8'],
    ];
    for (const [key, value] of defaults) {
      await pool.query(
        'INSERT INTO company_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }
  } catch (err) { console.error('[DB-Seed] company_settings seed error:', err.message); }

  // Seed default email templates
  try {
    const templates = [
      { slug:'welcome', name:'Welcome Email', subject:'Welcome to {{company_name}}!',
        body_html:'<h2>Welcome, {{full_name}}!</h2><p>Your account has been created on <strong>{{company_name}}</strong>.</p><p>Username: <strong>{{username}}</strong></p><p><a href="{{login_url}}">Login here</a></p>',
        body_text:'Welcome {{full_name}}! Login at: {{login_url}}', variables:'["full_name","username","company_name","login_url"]' },
      { slug:'password_reset', name:'Password Reset', subject:'Reset your {{company_name}} password',
        body_html:'<h2>Password Reset</h2><p>Hi {{full_name}},</p><p><a href="{{reset_url}}">Reset Password</a> (expires in 1 hour)</p>',
        body_text:'Hi {{full_name}}, reset at: {{reset_url}}', variables:'["full_name","reset_url","company_name"]' },
      { slug:'email_verification', name:'Email Verification', subject:'Verify your email address',
        body_html:'<h2>Verify Email</h2><p>Hi {{full_name}},</p><p><a href="{{verify_url}}">Verify Email</a></p>',
        body_text:'Hi {{full_name}}, verify at: {{verify_url}}', variables:'["full_name","verify_url"]' },
      { slug:'new_lead_assigned', name:'New Lead Assigned', subject:'New lead assigned: {{lead_name}}',
        body_html:'<h2>New Lead Assigned</h2><p>Hi {{assignee}},</p><p><strong>{{lead_name}}</strong> from {{company}}</p><p><a href="{{lead_url}}">View Lead</a></p>',
        body_text:'Hi {{assignee}}, new lead: {{lead_name}}. View: {{lead_url}}', variables:'["assignee","lead_name","company","lead_url"]' },
      { slug:'followup_reminder', name:'Follow-up Reminder', subject:'Reminder: follow up on {{lead_name}}',
        body_html:'<h2>Follow-up Reminder</h2><p>Hi {{assignee}},</p><p>You have a follow-up for <strong>{{lead_name}}</strong> today.</p><p><a href="{{lead_url}}">View Lead</a></p>',
        body_text:'Hi {{assignee}}, follow up on {{lead_name}} today. View: {{lead_url}}', variables:'["assignee","lead_name","lead_url"]' },
    ];
    for (const t of templates) {
      await pool.query(
        `INSERT INTO email_templates (slug,name,subject,body_html,body_text,variables)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO NOTHING`,
        [t.slug, t.name, t.subject, t.body_html, t.body_text, t.variables]
      );
    }
  } catch (err) { console.error('[DB-Seed] email_templates seed error:', err.message); }
})();

module.exports = {
  resolveDbConfig,
  ready,
  run: (...args) => ready.then(() => run(...args)),
  get: (...args) => ready.then(() => get(...args)),
  all: (...args) => ready.then(() => all(...args)),
  exec: (...args) => ready.then(() => exec(...args)),
};
