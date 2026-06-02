-- Migration 001: media URLs (link-based, AI-sendable)
-- Run on the weevbot PostgreSQL database

CREATE TABLE IF NOT EXISTS media_urls (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('document','video','image','audio')),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_urls_name_lower ON media_urls (LOWER(name));
