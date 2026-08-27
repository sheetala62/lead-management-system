-- Lead Management System - PostgreSQL Schema
-- This file matches the runtime initialization in backend/src/db.js.

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

-- Relationship notes:
-- users: one user can manage many leads (current app uses a shared admin user model)
-- leads: one lead can have many follow-up records
-- assignees: the app stores the assignee name as a free-text value on each lead
-- so historical records remain readable even if assignee names are later deactivated.
