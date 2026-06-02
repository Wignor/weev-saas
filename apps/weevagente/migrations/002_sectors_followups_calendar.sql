-- Migration 002: sectors, followups, google calendar settings

-- Sectors
CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sectors_tenant ON sectors(tenant_id);

-- Sector transfers log
CREATE TABLE IF NOT EXISTS sector_transfers (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  from_sector_id INT REFERENCES sectors(id) ON DELETE SET NULL,
  to_sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  transferred_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sector_transfers_conv ON sector_transfers(tenant_id, conversation_id);

-- Current sector assignment per conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectors(id) ON DELETE SET NULL;

-- Follow-up step configs (up to 5 per tenant)
CREATE TABLE IF NOT EXISTS followup_configs (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  step_order INT NOT NULL CHECK (step_order BETWEEN 1 AND 5),
  enabled BOOLEAN DEFAULT true,
  delay_minutes INT NOT NULL DEFAULT 60,
  message TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_followup_configs_tenant ON followup_configs(tenant_id);

-- Scheduled follow-up executions
CREATE TABLE IF NOT EXISTS scheduled_followups (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  step_order INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_followups_pending ON scheduled_followups(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_followups_conv ON scheduled_followups(tenant_id, conversation_id);

-- Google Calendar & openai_assistant_id settings (insert for all active tenants)
INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'openai_assistant_id', '', 'ID do Assistente OpenAI', 'ID do Assistente criado na plataforma OpenAI (começa com asst_).'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_calendar_id', '', 'Google Calendar ID', 'ID do calendário Google (ex: abc@group.calendar.google.com).'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_client_id', '', 'Google Client ID', 'Client ID da aplicação OAuth2 criada no Google Cloud Console.'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_client_secret', '', 'Google Client Secret', 'Client Secret da aplicação OAuth2 no Google Cloud Console.'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_refresh_token', '', 'Google Refresh Token', 'Token de atualização gerado após autorização OAuth2.'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_event_duration', '60', 'Duração Padrão do Evento (min)', 'Duração padrão dos eventos criados no Google Calendar (em minutos).'
FROM tenants ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, label, description)
SELECT id, 'google_timezone', 'America/Sao_Paulo', 'Fuso Horário do Calendar', 'Fuso horário dos eventos do Google Calendar. Ex: America/Sao_Paulo.'
FROM tenants ON CONFLICT DO NOTHING;
