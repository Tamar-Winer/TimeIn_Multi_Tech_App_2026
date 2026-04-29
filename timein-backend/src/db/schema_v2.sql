
-- Migration v2 — run once after schema.sql
-- Adds: hourly_rate on users, api_keys table, settings table

ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS api_keys (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  key_hash    VARCHAR(255) NOT NULL UNIQUE,
  key_prefix  VARCHAR(20)  NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('slack_webhook_url', ''),
  ('slack_enabled', 'false'),
  ('reminder_enabled', 'false'),
  ('reminder_hour', '17'),
  ('retroactive_allowed', 'true'),
  ('retroactive_max_days', '30')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
