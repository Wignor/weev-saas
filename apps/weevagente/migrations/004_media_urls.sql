-- Migration 004: media URLs (link-based, AI-sendable)
-- Run on the weevagente PostgreSQL database

CREATE TABLE IF NOT EXISTS media_urls (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('document','video','image','audio')),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_urls_tenant_name ON media_urls (tenant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_media_urls_tenant ON media_urls (tenant_id);
