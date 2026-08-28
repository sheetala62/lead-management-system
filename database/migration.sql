-- =============================================================================
-- Lead Management System — Feature Migration
-- Run this ONCE against your existing database to add new CRM features.
-- All statements use IF NOT EXISTS / DO NOTHING so re-running is safe.
-- =============================================================================

-- ── 1. Add priority column to leads ─────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium';

-- ── 2. Lead Notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_notes (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note        TEXT    NOT NULL,
  created_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);

-- ── 3. Tags (global tag registry + per-lead junction) ────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag  ON lead_tags(tag_id);

-- ── 4. File Attachment Metadata ───────────────────────────────────────────────
-- Actual file bytes are NOT stored in the DB.
-- This table records metadata for files the user has "attached" (name, size, type).
-- The frontend keeps the actual File objects in memory / localStorage for demo.
CREATE TABLE IF NOT EXISTS lead_attachments (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  file_name    VARCHAR(500) NOT NULL,
  file_size    INTEGER NOT NULL DEFAULT 0,
  file_type    VARCHAR(200) NOT NULL DEFAULT '',
  uploaded_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead ON lead_attachments(lead_id);

-- ── 5. Activity Log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activity (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,   -- e.g. 'status_changed', 'note_added', 'followup_added'
  description TEXT        NOT NULL,
  actor       VARCHAR(255) NOT NULL DEFAULT 'admin',
  meta        TEXT,                    -- JSON string for extra context
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_time ON lead_activity(created_at DESC);

-- ── 6. Saved Filters ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_filters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_by  VARCHAR(255) NOT NULL DEFAULT 'admin',
  filter_json TEXT        NOT NULL,   -- JSON stringified filter object
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(created_by);

-- ── 7. Seed a few example tags ────────────────────────────────────────────────
INSERT INTO tags (name, color) VALUES
  ('Hot Lead',   '#ef4444'),
  ('Cold Lead',  '#3b82f6'),
  ('VIP',        '#8b5cf6'),
  ('Follow Up',  '#f59e0b'),
  ('Enterprise', '#0891b2')
ON CONFLICT (name) DO NOTHING;
