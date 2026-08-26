-- Lead Management System - Database Schema (SQLite)
-- This is generated automatically by backend/src/db.js on first run.
-- Included here as a standalone reference for submission, as requested
-- in the assessment ("Database structure/schema - diagram, SQL file or equivalent").

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt hash, never plain text
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1  -- soft-disable instead of deleting, so
                                      -- historical leads keep a valid assignee name
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  service_required TEXT NOT NULL,    -- Website Development | Web Application |
                                      -- Mobile Application | E-Commerce | SEO |
                                      -- Digital Marketing | Other
  lead_source TEXT NOT NULL,         -- Website | WhatsApp | Referral | LinkedIn |
                                      -- Google | Facebook | Other
  estimated_value REAL,
  assigned_to TEXT NOT NULL,
  remarks TEXT,
  lead_status TEXT NOT NULL DEFAULT 'New',
                                      -- New | Contacted | Proposal Sent |
                                      -- Negotiation | Won | Lost
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  followup_date TEXT NOT NULL,
  followup_type TEXT NOT NULL,       -- Call | Email | WhatsApp | Meeting | Other
  remarks TEXT,
  next_followup_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leads_status   ON leads(lead_status);
CREATE INDEX idx_leads_service  ON leads(service_required);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_followups_lead ON followups(lead_id);

-- Relationships
-- leads (1) ----< followups (many)   -- one lead has many follow-up entries
-- assignees.name is used as a free-text reference on leads.assigned_to rather
-- than a strict foreign key, so a lead's history stays readable even if an
-- assignee is later deactivated. See DESIGN_NOTES.md for the reasoning.

-- ER Diagram (text form)
--
--   users                assignees                 leads                    followups
--   -----                ---------                 -----                    ---------
--   id PK                id PK                     id PK                    id PK
--   username              name                      lead_name                lead_id FK -> leads.id
--   password_hash          active                    company_name             followup_date
--   role                                             mobile                   followup_type
--   created_at                                       email                    remarks
--                                                     service_required         next_followup_date
--                                                     lead_source              created_at
--                                                     estimated_value
--                                                     assigned_to  ----------> (matches assignees.name)
--                                                     remarks
--                                                     lead_status
--                                                     created_at
--                                                     updated_at
