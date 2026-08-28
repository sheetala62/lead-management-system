-- =============================================================================
-- Lead Management System — Company CRM Migration 2
-- Run ONCE against your existing database. All statements are safe to re-run.
-- =============================================================================

-- ── 1. Extend users table ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email          VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          VARCHAR(30)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT         NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active      SMALLINT     NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified SMALLINT     NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login     TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- ── 2. Company Settings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(100) UNIQUE NOT NULL,
  value           TEXT        NOT NULL DEFAULT '',
  updated_by      VARCHAR(255) NOT NULL DEFAULT 'admin',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_settings_key ON company_settings(key);

-- ── 3. Email Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  subject     VARCHAR(500) NOT NULL,
  body_html   TEXT        NOT NULL,
  body_text   TEXT        NOT NULL DEFAULT '',
  variables   TEXT        NOT NULL DEFAULT '[]',  -- JSON array of variable names
  is_active   SMALLINT    NOT NULL DEFAULT 1,
  updated_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);

-- ── 4. Login History ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_history (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    VARCHAR(255) NOT NULL,
  ip_address  VARCHAR(100) NOT NULL DEFAULT '',
  user_agent  TEXT        NOT NULL DEFAULT '',
  status      VARCHAR(20) NOT NULL DEFAULT 'success',  -- success | failed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user   ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time   ON login_history(created_at DESC);

-- ── 5. Audit Logs ─────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time  ON audit_logs(created_at DESC);

-- ── 6. Password Reset Tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user  ON password_reset_tokens(user_id);

-- ── 7. Email Verification Tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token);

-- ── 8. Staff Invites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_invites (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'staff',
  token       VARCHAR(255) UNIQUE NOT NULL,
  invited_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  expires_at  TIMESTAMPTZ NOT NULL,
  used        SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites(token);

-- ── 9. Seed default company settings ─────────────────────────────────────────
INSERT INTO company_settings (key, value) VALUES
  ('company_name',       'LeadMS CRM'),
  ('company_tagline',    'Manage every lead. Close every deal.'),
  ('company_email',      'admin@leadms.com'),
  ('company_phone',      ''),
  ('company_website',    ''),
  ('company_address',    ''),
  ('company_logo_url',   ''),
  ('company_favicon_url',''),
  ('primary_color',      '#4f46e5'),
  ('accent_color',       '#f97316'),
  ('smtp_host',          ''),
  ('smtp_port',          '587'),
  ('smtp_user',          ''),
  ('smtp_pass',          ''),
  ('smtp_from_name',     'LeadMS CRM'),
  ('smtp_from_email',    'noreply@leadms.com'),
  ('smtp_secure',        'false'),
  ('whatsapp_api_url',   ''),
  ('whatsapp_token',     ''),
  ('whatsapp_from',      ''),
  ('whatsapp_enabled',   'false'),
  ('timezone',           'Asia/Kolkata'),
  ('date_format',        'DD/MM/YYYY'),
  ('currency',           'INR'),
  ('currency_symbol',    '₹'),
  ('support_email',      'support@leadms.com'),
  ('support_phone',      ''),
  ('allow_registration', 'false'),
  ('require_email_verification', 'false'),
  ('session_timeout_hours', '8')
ON CONFLICT (key) DO NOTHING;

-- ── 10. Seed default email templates ─────────────────────────────────────────
INSERT INTO email_templates (slug, name, subject, body_html, body_text, variables) VALUES
(
  'welcome',
  'Welcome Email',
  'Welcome to {{company_name}}!',
  '<h2>Welcome, {{full_name}}!</h2><p>Your account has been created on <strong>{{company_name}}</strong>.</p><p>Username: <strong>{{username}}</strong></p><p>Please login at <a href="{{login_url}}">{{login_url}}</a></p>',
  'Welcome {{full_name}}! Your account on {{company_name}} is ready. Login at: {{login_url}}',
  '["full_name","username","company_name","login_url"]'
),
(
  'password_reset',
  'Password Reset',
  'Reset your {{company_name}} password',
  '<h2>Password Reset Request</h2><p>Hi {{full_name}},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="{{reset_url}}">Reset Password</a></p><p>If you did not request this, ignore this email.</p>',
  'Hi {{full_name}}, reset your password at: {{reset_url}} (expires in 1 hour)',
  '["full_name","reset_url","company_name"]'
),
(
  'email_verification',
  'Email Verification',
  'Verify your email address',
  '<h2>Verify Your Email</h2><p>Hi {{full_name}},</p><p>Click below to verify your email address:</p><p><a href="{{verify_url}}">Verify Email</a></p>',
  'Hi {{full_name}}, verify your email at: {{verify_url}}',
  '["full_name","verify_url","company_name"]'
),
(
  'new_lead_assigned',
  'New Lead Assigned',
  'New lead assigned to you: {{lead_name}}',
  '<h2>New Lead Assigned</h2><p>Hi {{assignee}},</p><p>A new lead has been assigned to you:</p><ul><li><strong>Name:</strong> {{lead_name}}</li><li><strong>Company:</strong> {{company_name}}</li><li><strong>Service:</strong> {{service}}</li></ul><p><a href="{{lead_url}}">View Lead</a></p>',
  'Hi {{assignee}}, new lead assigned: {{lead_name}} from {{company_name}}. View: {{lead_url}}',
  '["assignee","lead_name","company_name","service","lead_url"]'
),
(
  'followup_reminder',
  'Follow-up Reminder',
  'Follow-up reminder: {{lead_name}}',
  '<h2>Follow-up Reminder</h2><p>Hi {{assignee}},</p><p>You have a follow-up scheduled for <strong>{{lead_name}}</strong> today.</p><p><a href="{{lead_url}}">View Lead</a></p>',
  'Hi {{assignee}}, follow-up reminder for {{lead_name}} today. View: {{lead_url}}',
  '["assignee","lead_name","lead_url","followup_date"]'
)
ON CONFLICT (slug) DO NOTHING;
