-- Migration 005: operators (team members per tenant)

CREATE TABLE IF NOT EXISTS operators (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  sector_id   INT REFERENCES sectors(id) ON DELETE SET NULL,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_email ON operators(email);
CREATE INDEX IF NOT EXISTS idx_operators_tenant ON operators(tenant_id);
