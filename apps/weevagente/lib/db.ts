import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'postgres'}:5432/weevagente`,
});

export type TenantStatus = 'pending_setup' | 'active' | 'suspended' | 'cancelled';
export type ConversationStatus = 'active' | 'paused' | 'waiting';

export interface Tenant {
  id: string;
  email: string;
  name: string | null;
  status: TenantStatus;
  evolution_instance: string | null;
  kiwify_subscriber_id: string | null;
  kiwify_subscription_id: string | null;
  setup_token: string | null;
  setup_token_expires_at: string | null;
  max_instances: number;
  created_at: string;
}

export interface TenantInstance {
  id: string;
  tenant_id: string;
  instance_name: string;
  label: string | null;
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  push_name: string | null;
  status: ConversationStatus;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'human';
  content: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  label: string;
  description: string;
}

export interface QuickReply {
  id: number;
  tenant_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Contact {
  number: string;
  tenant_id: string;
  push_name: string | null;
  status: string;
  last_seen: string | null;
  created_at: string;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant & { password_hash: string }>(
    'SELECT * FROM tenants WHERE email = $1', [email]
  );
  return rows[0] ?? null;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getTenantByEvolutionInstance(instance: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>(
    'SELECT * FROM tenants WHERE evolution_instance = $1', [instance]
  );
  return rows[0] ?? null;
}

export async function getTenantPasswordHash(email: string): Promise<string | null> {
  const { rows } = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM tenants WHERE email = $1', [email]
  );
  return rows[0]?.password_hash ?? null;
}

export async function createTenant(email: string, name: string, kiwifySubscriberId: string, kiwifySubscriptionId: string, setupToken: string): Promise<Tenant> {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query<Tenant>(
    `INSERT INTO tenants (email, name, status, kiwify_subscriber_id, kiwify_subscription_id, setup_token, setup_token_expires_at)
     VALUES ($1, $2, 'pending_setup', $3, $4, $5, $6) RETURNING *`,
    [email, name, kiwifySubscriberId, kiwifySubscriptionId, setupToken, expires]
  );
  const tenant = rows[0];
  await initTenantSettings(tenant.id);
  return tenant;
}

export async function activateTenant(kiwifySubscriptionId: string): Promise<void> {
  await pool.query(
    `UPDATE tenants SET status = 'active', updated_at = NOW()
     WHERE kiwify_subscription_id = $1 AND status != 'pending_setup'`,
    [kiwifySubscriptionId]
  );
}

export async function suspendTenant(kiwifySubscriptionId: string): Promise<void> {
  await pool.query(
    `UPDATE tenants SET status = 'suspended', updated_at = NOW()
     WHERE kiwify_subscription_id = $1`,
    [kiwifySubscriptionId]
  );
}

export async function getTenantBySetupToken(token: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>(
    `SELECT * FROM tenants WHERE setup_token = $1 AND setup_token_expires_at > NOW()`,
    [token]
  );
  return rows[0] ?? null;
}

export async function completeTenantSetup(tenantId: string, passwordHash: string, instance: string): Promise<void> {
  await pool.query(
    `UPDATE tenants SET password_hash = $1, evolution_instance = $2, status = 'active',
     setup_token = NULL, setup_token_expires_at = NULL, updated_at = NOW()
     WHERE id = $3`,
    [passwordHash, instance, tenantId]
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = [
  { key: 'system_prompt',           label: 'Prompt do Agente IA',              description: 'Instrucao principal que define a personalidade e comportamento do agente.', value: '' },
  { key: 'welcome_message',         label: 'Mensagem de Boas-vindas',           description: 'Mensagem enviada automaticamente ao primeiro contato. Use {nome} para o nome do cliente.', value: 'Ola, {nome}! Seja bem-vindo!\n\nVoce ja e nosso cliente ou esta conhecendo nossos servicos?\n\n*JA SOU CLIENTE*\n*QUERO CONHECER*' },
  { key: 'openai_api_key',          label: 'OpenAI API Key',                    description: 'Chave secreta da OpenAI (sk-...). Alteracoes entram em vigor imediatamente.', value: '' },
  { key: 'openai_model',            label: 'Modelo OpenAI',                     description: 'Modelo usado pelo agente. Ex: gpt-4o, gpt-4o-mini, gpt-3.5-turbo.', value: 'gpt-4o-mini' },
  { key: 'max_history_messages',    label: 'Historico de Mensagens',            description: 'Numero de mensagens anteriores enviadas como contexto para a IA.', value: '20' },
  { key: 'notification_number',     label: 'Numero do Atendente (notificacao)', description: 'Numero WhatsApp que recebe alertas quando a IA acionar o atendente humano.', value: '' },
  { key: 'ai_reactivation_minutes', label: 'Reativacao da IA (minutos)',        description: 'Apos o atendente humano responder, a IA volta em X minutos. Ex: 5 = 5 min, 60 = 1 hora.', value: '60' },
  { key: 'video_url',               label: 'URL do Video',                      description: 'URL do video enviado quando a ferramenta send_video e acionada.', value: '' },
  { key: 'pdf_url',                 label: 'URL do PDF / Documento',            description: 'URL do PDF enviado quando a ferramenta send_pdf e acionada.', value: '' },
  { key: 'tts_enabled',             label: 'Resposta em Audio (TTS)',            description: 'Ativa a resposta da IA em audio (nota de voz) via OpenAI TTS.', value: 'false' },
  { key: 'tts_mode',                label: 'Modo TTS',                          description: 'Define se a IA envia texto, audio ou ambos quando TTS esta ativo.', value: 'both' },
  { key: 'tts_voice',               label: 'Voz do TTS',                        description: 'Voz utilizada na sintese de fala. Nova = feminina natural.', value: 'nova' },
  { key: 'allowed_numbers',         label: 'Somente Responder (Whitelist)',      description: 'Se preenchido, a IA so responde os numeros listados. Deixe vazio para responder todos.', value: '' },
  { key: 'blocked_numbers',         label: 'Nao Responder (Blacklist)',          description: 'Numeros que a IA nunca deve responder.', value: '' },
  { key: 'signature_enabled',       label: 'Assinatura do Atendente',           description: 'Quando ativada, o texto configurado e adicionado automaticamente ao final de cada mensagem enviada manualmente pelo atendente.', value: 'false' },
  { key: 'signature_text',          label: 'Texto da Assinatura',               description: 'Texto que aparece ao final das suas mensagens. Ex: "Atenciosamente, Joao | Suporte WeevZap". Use {nome} para incluir o nome do atendente.', value: '' },
  { key: 'meta_phone_number_id',    label: 'Phone Number ID (Meta API Oficial)', description: 'ID do numero de telefone no Meta Business Manager. Encontrado em: WhatsApp > API Setup > Phone Number ID.', value: '' },
  { key: 'meta_access_token',       label: 'Token de Acesso (Meta API Oficial)', description: 'Token permanente de acesso da Meta. Gere em: Meta for Developers > WhatsApp > Configuration > Temporary/Permanent Token.', value: '' },
  { key: 'meta_business_account_id', label: 'Business Account ID (Meta)',        description: 'ID da conta comercial. Necessario para listar seus templates aprovados. Encontrado no Meta Business Manager.', value: '' },
];

async function initTenantSettings(tenantId: string): Promise<void> {
  for (const s of DEFAULT_SETTINGS) {
    await pool.query(
      `INSERT INTO settings (tenant_id, key, value, label, description)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [tenantId, s.key, s.value, s.label, s.description]
    );
  }
}

export async function getAllSettings(tenantId: string): Promise<Setting[]> {
  const { rows } = await pool.query<Setting>(
    `SELECT key, value, label, description FROM settings WHERE tenant_id = $1 ORDER BY key`,
    [tenantId]
  );
  return rows;
}

export async function getSetting(tenantId: string, key: string): Promise<string | null> {
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM settings WHERE tenant_id = $1 AND key = $2`,
    [tenantId, key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(tenantId: string, key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO settings (tenant_id, key, value, label, description)
     VALUES ($1, $2, $3, $2, '')
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [tenantId, key, value]
  );
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function upsertConversation(tenantId: string, number: string, status: ConversationStatus, lastMessage?: string, pushName?: string): Promise<void> {
  const fields = ['id', 'tenant_id', 'status', 'last_message_at'];
  const values: unknown[] = [number, tenantId, status, new Date()];
  const updates = ['status = EXCLUDED.status', 'last_message_at = EXCLUDED.last_message_at'];

  if (lastMessage !== undefined) { fields.push('last_message'); values.push(lastMessage); updates.push('last_message = EXCLUDED.last_message'); }
  if (pushName) { fields.push('push_name'); values.push(pushName); updates.push('push_name = EXCLUDED.push_name'); }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `INSERT INTO conversations (${fields.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (id, tenant_id) DO UPDATE SET ${updates.join(', ')}`,
    values
  );
}

export async function getConversations(tenantId: string): Promise<Conversation[]> {
  const { rows } = await pool.query<Conversation>(
    `SELECT * FROM conversations WHERE tenant_id = $1 ORDER BY last_message_at DESC NULLS LAST LIMIT 100`,
    [tenantId]
  );
  return rows;
}

export async function getConversation(tenantId: string, id: string): Promise<Conversation | null> {
  const { rows } = await pool.query<Conversation>(
    `SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]
  );
  return rows[0] ?? null;
}

export async function updateConversationStatus(tenantId: string, id: string, status: ConversationStatus): Promise<void> {
  await pool.query(`UPDATE conversations SET status = $1 WHERE id = $2 AND tenant_id = $3`, [status, id, tenantId]);
}

export async function deleteConversation(tenantId: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM messages WHERE conversation_id = $1 AND tenant_id = $2`, [id, tenantId]);
  await pool.query(`DELETE FROM conversations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function saveMessage(tenantId: string, conversationId: string, id: string, role: Message['role'], content: string): Promise<void> {
  await pool.query(
    `INSERT INTO messages (id, tenant_id, conversation_id, role, content)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id, tenant_id) DO NOTHING`,
    [id, tenantId, conversationId, role, content]
  );
}

export async function getMessages(tenantId: string, conversationId: string): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at ASC LIMIT 200`,
    [conversationId, tenantId]
  );
  return rows;
}

export async function getConversationHistory(tenantId: string, number: string, limit = 20, windowHours = 48): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 AND tenant_id = $2 AND created_at > NOW() - ($4 * INTERVAL '1 hour') ORDER BY created_at ASC LIMIT $3`,
    [number, tenantId, limit, windowHours]
  );
  return rows;
}

// ─── Quick Replies ────────────────────────────────────────────────────────────

export async function getQuickReplies(tenantId: string): Promise<QuickReply[]> {
  const { rows } = await pool.query<QuickReply>(
    `SELECT * FROM quick_replies WHERE tenant_id = $1 ORDER BY title`, [tenantId]
  );
  return rows;
}

export async function createQuickReply(tenantId: string, title: string, content: string): Promise<QuickReply> {
  const { rows } = await pool.query<QuickReply>(
    `INSERT INTO quick_replies (tenant_id, title, content) VALUES ($1, $2, $3) RETURNING *`,
    [tenantId, title, content]
  );
  return rows[0];
}

export async function deleteQuickReply(tenantId: string, id: number): Promise<void> {
  await pool.query(`DELETE FROM quick_replies WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContact(tenantId: string, number: string): Promise<Contact | null> {
  const { rows } = await pool.query<Contact>(
    `SELECT * FROM contacts WHERE number = $1 AND tenant_id = $2`, [number, tenantId]
  );
  return rows[0] ?? null;
}

export async function insertNewContact(tenantId: string, number: string, pushName: string | undefined): Promise<void> {
  await pool.query(
    `INSERT INTO contacts (number, tenant_id, push_name, status) VALUES ($1, $2, $3, 'pendente_classificacao') ON CONFLICT DO NOTHING`,
    [number, tenantId, pushName ?? null]
  );
}

export async function setContactStatus(tenantId: string, number: string, status: string, pushName?: string): Promise<void> {
  await pool.query(
    `UPDATE contacts SET status = $1, push_name = COALESCE($2, push_name), last_seen = NOW() WHERE number = $3 AND tenant_id = $4`,
    [status, pushName ?? null, number, tenantId]
  );
}

export async function touchContact(tenantId: string, number: string, pushName?: string): Promise<void> {
  await pool.query(
    `UPDATE contacts SET last_seen = NOW(), push_name = COALESCE($1, push_name) WHERE number = $2 AND tenant_id = $3`,
    [pushName ?? null, number, tenantId]
  );
}

// ─── Tenant Instances ─────────────────────────────────────────────────────────

export async function getTenantInstances(tenantId: string): Promise<TenantInstance[]> {
  const { rows } = await pool.query<TenantInstance>(
    `SELECT * FROM tenant_instances WHERE tenant_id = $1 ORDER BY created_at ASC`,
    [tenantId]
  );
  return rows;
}

export async function addTenantInstance(tenantId: string, instanceName: string, label: string): Promise<TenantInstance> {
  const { rows } = await pool.query<TenantInstance>(
    `INSERT INTO tenant_instances (tenant_id, instance_name, label) VALUES ($1, $2, $3) RETURNING *`,
    [tenantId, instanceName, label]
  );
  return rows[0];
}

export async function getTenantByInstance(instance: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>(
    `SELECT DISTINCT t.* FROM tenants t
     LEFT JOIN tenant_instances ti ON ti.tenant_id = t.id
     WHERE ti.instance_name = $1 OR t.evolution_instance = $1
     LIMIT 1`,
    [instance]
  );
  return rows[0] ?? null;
}

export async function incrementMaxInstances(kiwifySubscriptionId: string): Promise<void> {
  await pool.query(
    `UPDATE tenants SET max_instances = max_instances + 1 WHERE kiwify_subscription_id = $1`,
    [kiwifySubscriptionId]
  );
}

export async function incrementMaxInstancesByEmail(email: string): Promise<void> {
  await pool.query(
    `UPDATE tenants SET max_instances = max_instances + 1 WHERE email = $1`,
    [email]
  );
}

// ─── Scheduled Broadcasts ────────────────────────────────────────────────────

export interface ScheduledBroadcast {
  id: number;
  tenant_id: string;
  msg_type: string;
  template_name: string | null;
  template_lang: string | null;
  template_vars: string[] | null;
  free_text: string | null;
  numbers: string[];
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  result_count: number | null;
  created_at: string;
}

export async function createScheduledBroadcast(
  tenantId: string,
  msgType: string,
  numbers: string[],
  scheduledAt: Date,
  opts: { templateName?: string; templateLang?: string; templateVars?: string[]; freeText?: string }
): Promise<ScheduledBroadcast> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `INSERT INTO scheduled_broadcasts (tenant_id, msg_type, template_name, template_lang, template_vars, free_text, numbers, scheduled_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8) RETURNING *`,
    [tenantId, msgType, opts.templateName ?? null, opts.templateLang ?? null,
     opts.templateVars ? JSON.stringify(opts.templateVars) : null,
     opts.freeText ?? null, JSON.stringify(numbers), scheduledAt]
  );
  return rows[0];
}

export async function getPendingScheduledBroadcasts(): Promise<ScheduledBroadcast[]> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `SELECT * FROM scheduled_broadcasts WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT 20`
  );
  return rows;
}

export async function getRecentScheduledBroadcasts(tenantId: string): Promise<ScheduledBroadcast[]> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `SELECT * FROM scheduled_broadcasts WHERE tenant_id = $1 ORDER BY scheduled_at DESC LIMIT 15`,
    [tenantId]
  );
  return rows;
}

export async function markBroadcastSent(id: number, resultCount: number): Promise<void> {
  await pool.query(
    `UPDATE scheduled_broadcasts SET status = 'sent', sent_at = NOW(), result_count = $2 WHERE id = $1`,
    [id, resultCount]
  );
}

export async function markBroadcastFailed(id: number, error: string): Promise<void> {
  await pool.query(
    `UPDATE scheduled_broadcasts SET status = 'failed', error = $2 WHERE id = $1`,
    [id, error]
  );
}
