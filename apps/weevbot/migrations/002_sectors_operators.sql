-- Migration 002: sectors and operators

CREATE TABLE IF NOT EXISTS sectors (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectors(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sector_transfers (
  id               SERIAL PRIMARY KEY,
  conversation_id  TEXT NOT NULL,
  from_sector_id   INT REFERENCES sectors(id) ON DELETE SET NULL,
  to_sector_id     INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  transferred_by   TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operators (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  sector_id     INT REFERENCES sectors(id) ON DELETE SET NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
