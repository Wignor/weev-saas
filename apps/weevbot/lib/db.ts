import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'postgres'}:5432/weevbot`,
});

export type ConversationStatus = 'active' | 'paused' | 'waiting';

export interface Conversation {
  id: string;
  push_name: string | null;
  status: ConversationStatus;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
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

// ─── Conversations ───────────────────────────────────────────────────────────

export async function upsertConversation(
  number: string,
  status: ConversationStatus,
  lastMessage?: string,
  pushName?: string
) {
  const fields: string[] = ['id', 'status', 'last_message_at'];
  const values: unknown[] = [number, status, new Date()];
  const updates: string[] = [
    'status = EXCLUDED.status',
    'last_message_at = EXCLUDED.last_message_at',
  ];

  if (lastMessage !== undefined) {
    fields.push('last_message');
    values.push(lastMessage);
    updates.push('last_message = EXCLUDED.last_message');
  }
  if (pushName) {
    fields.push('push_name');
    values.push(pushName);
    updates.push('push_name = EXCLUDED.push_name');
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `INSERT INTO conversations (${fields.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
    values
  );
}

export async function getConversations(): Promise<Conversation[]> {
  const { rows } = await pool.query<Conversation>(
    `SELECT * FROM conversations ORDER BY last_message_at DESC NULLS LAST LIMIT 100`
  );
  return rows;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { rows } = await pool.query<Conversation>(
    `SELECT * FROM conversations WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateConversationStatus(id: string, status: ConversationStatus) {
  await pool.query(`UPDATE conversations SET status = $1 WHERE id = $2`, [status, id]);
}

export async function deleteConversation(id: string): Promise<void> {
  await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [id]);
  await pool.query(`DELETE FROM conversations WHERE id = $1`, [id]);
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function saveMessage(
  conversationId: string,
  id: string,
  role: Message['role'],
  content: string
) {
  await pool.query(
    `INSERT INTO messages (id, conversation_id, role, content)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [id, conversationId, role, content]
  );
}

export async function getConversationHistory(number: string, limit = 20, windowHours = 48): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 AND created_at > NOW() - ($3 * INTERVAL '1 hour') ORDER BY created_at ASC LIMIT $2`,
    [number, limit, windowHours]
  );
  return rows;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
    [conversationId]
  );
  return rows;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function getAllSettings(): Promise<Setting[]> {
  const { rows } = await pool.query<Setting>(
    `SELECT key, value, label, description FROM settings ORDER BY key`
  );
  return rows;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value, label, description)
     VALUES ($1, $2, $1, '')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

// ─── Quick Replies ────────────────────────────────────────────────────────────

export interface QuickReply {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export async function getQuickReplies(): Promise<QuickReply[]> {
  const { rows } = await pool.query<QuickReply>(
    `SELECT * FROM quick_replies ORDER BY title`
  );
  return rows;
}

export async function createQuickReply(title: string, content: string): Promise<QuickReply> {
  const { rows } = await pool.query<QuickReply>(
    `INSERT INTO quick_replies (title, content) VALUES ($1, $2) RETURNING *`,
    [title, content]
  );
  return rows[0];
}

export async function deleteQuickReply(id: number): Promise<void> {
  await pool.query(`DELETE FROM quick_replies WHERE id = $1`, [id]);
}

// ─── Media Library ────────────────────────────────────────────────────────────

export interface MediaItem {
  id: number;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
}

export async function getMediaItems(): Promise<MediaItem[]> {
  const { rows } = await pool.query<MediaItem>(
    `SELECT * FROM media_library ORDER BY created_at DESC`
  );
  return rows;
}

export async function createMediaItem(
  name: string,
  type: string,
  url: string,
  fileName: string,
  sizeBytes: number
): Promise<MediaItem> {
  const { rows } = await pool.query<MediaItem>(
    `INSERT INTO media_library (name, type, url, file_name, size_bytes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, type, url, fileName, sizeBytes]
  );
  return rows[0];
}

export async function getMediaItem(id: number): Promise<MediaItem | null> {
  const { rows } = await pool.query<MediaItem>(
    `SELECT * FROM media_library WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteMediaItemById(id: number): Promise<string | null> {
  const { rows } = await pool.query<{ url: string }>(
    `DELETE FROM media_library WHERE id = $1 RETURNING url`,
    [id]
  );
  return rows[0]?.url ?? null;
}

export async function getStorageUsed(): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(size_bytes), 0)::text AS total FROM media_library`
  );
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ─── Media URLs (link-based, AI-sendable) ─────────────────────────────────────

export interface MediaUrlItem {
  id: number;
  name: string;
  url: string;
  type: 'document' | 'video' | 'image' | 'audio';
  description: string | null;
  created_at: string;
}

export async function getMediaUrls(): Promise<MediaUrlItem[]> {
  const { rows } = await pool.query<MediaUrlItem>(
    `SELECT * FROM media_urls ORDER BY name ASC`
  );
  return rows;
}

export async function createMediaUrl(name: string, url: string, type: string, description?: string): Promise<MediaUrlItem> {
  const { rows } = await pool.query<MediaUrlItem>(
    `INSERT INTO media_urls (name, url, type, description) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, url, type, description || null]
  );
  return rows[0];
}

export async function deleteMediaUrl(id: number): Promise<void> {
  await pool.query(`DELETE FROM media_urls WHERE id = $1`, [id]);
}

export async function getMediaUrlByName(name: string): Promise<MediaUrlItem | null> {
  const { rows } = await pool.query<MediaUrlItem>(
    `SELECT * FROM media_urls WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return rows[0] ?? null;
}

// ─── Scheduled Broadcasts ────────────────────────────────────────────────────

export interface ScheduledBroadcast {
  id: number;
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
  msgType: string,
  numbers: string[],
  scheduledAt: Date,
  opts: { templateName?: string; templateLang?: string; templateVars?: string[]; freeText?: string }
): Promise<ScheduledBroadcast> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `INSERT INTO scheduled_broadcasts (msg_type, template_name, template_lang, template_vars, free_text, numbers, scheduled_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7) RETURNING *`,
    [msgType, opts.templateName ?? null, opts.templateLang ?? null,
     opts.templateVars ? JSON.stringify(opts.templateVars) : null,
     opts.freeText ?? null, JSON.stringify(numbers), scheduledAt]
  );
  return rows[0];
}

export async function getPendingScheduledBroadcasts(): Promise<ScheduledBroadcast[]> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `SELECT * FROM scheduled_broadcasts WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT 10`
  );
  return rows;
}

export async function getRecentScheduledBroadcasts(): Promise<ScheduledBroadcast[]> {
  const { rows } = await pool.query<ScheduledBroadcast>(
    `SELECT * FROM scheduled_broadcasts ORDER BY scheduled_at DESC LIMIT 15`
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

// ─── Users (admin) ───────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
}

export async function getUsers(): Promise<User[]> {
  const { rows } = await pool.query<User>(
    `SELECT id, email, name, created_at FROM users ORDER BY created_at DESC`
  );
  return rows;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    `SELECT id, email, name, created_at FROM users WHERE email = $1`, [email]
  );
  return rows[0] ?? null;
}

export async function getUserPasswordHash(email: string): Promise<string | null> {
  const { rows } = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE email = $1`, [email]
  );
  return rows[0]?.password_hash ?? null;
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<User> {
  const { rows } = await pool.query<User>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at`,
    [email, name, passwordHash]
  );
  return rows[0];
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, id]);
}

export async function updateUserPasswordByEmail(email: string, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, email]);
}

export async function deleteUser(id: number): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}

// ─── Daily Report ────────────────────────────────────────────────────────────

export interface DailyReport {
  total_conversations: number;
  new_contacts: number;
  human_paused: number;
  ai_active: number;
  messages_sent: number;
  by_hour: { hour: number; count: number }[];
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  const start = `${date} 00:00:00`;
  const end   = `${date} 23:59:59`;
  const [totalR, newR, humanR, aiR, msgsR, hourR] = await Promise.all([
    pool.query(`SELECT COUNT(DISTINCT conversation_id) as count FROM messages WHERE created_at BETWEEN $1 AND $2`, [start, end]),
    pool.query(`SELECT COUNT(*) as count FROM conversations WHERE DATE(created_at) = $1`, [date]),
    pool.query(`SELECT COUNT(*) as count FROM conversations WHERE status = 'paused'`),
    pool.query(`SELECT COUNT(*) as count FROM conversations WHERE status = 'active'`),
    pool.query(`SELECT COUNT(*) as count FROM messages WHERE created_at BETWEEN $1 AND $2`, [start, end]),
    pool.query(`SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count FROM messages WHERE created_at BETWEEN $1 AND $2 GROUP BY hour ORDER BY hour`, [start, end]),
  ]);
  return {
    total_conversations: parseInt(totalR.rows[0]?.count || '0'),
    new_contacts: parseInt(newR.rows[0]?.count || '0'),
    human_paused: parseInt(humanR.rows[0]?.count || '0'),
    ai_active: parseInt(aiR.rows[0]?.count || '0'),
    messages_sent: parseInt(msgsR.rows[0]?.count || '0'),
    by_hour: hourR.rows.map(r => ({ hour: parseInt(String(r.hour)), count: parseInt(r.count) })),
  };
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export interface FollowupConfig {
  id?: number;
  step_order: number;
  enabled: boolean;
  delay_minutes: number;
  message: string;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
}

export async function getFollowupConfigs(): Promise<FollowupConfig[]> {
  const { rows } = await pool.query<FollowupConfig>(
    `SELECT * FROM followup_configs ORDER BY step_order ASC`
  );
  return rows;
}

export async function upsertFollowupConfig(
  stepOrder: number,
  data: { enabled: boolean; delay_minutes: number; message: string; file_url?: string | null; file_type?: string | null; file_name?: string | null }
): Promise<void> {
  await pool.query(
    `INSERT INTO followup_configs (step_order, enabled, delay_minutes, message, file_url, file_type, file_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (step_order) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       delay_minutes = EXCLUDED.delay_minutes,
       message = EXCLUDED.message,
       file_url = EXCLUDED.file_url,
       file_type = EXCLUDED.file_type,
       file_name = EXCLUDED.file_name`,
    [stepOrder, data.enabled, data.delay_minutes, data.message, data.file_url ?? null, data.file_type ?? null, data.file_name ?? null]
  );
}

export async function scheduleFollowups(conversationId: string, configs: FollowupConfig[]): Promise<void> {
  await pool.query(
    `UPDATE scheduled_followups SET status = 'cancelled' WHERE conversation_id = $1 AND status = 'pending'`,
    [conversationId]
  );
  const enabled = configs.filter(c => c.enabled && c.message?.trim());
  if (!enabled.length) return;
  let cumulativeMinutes = 0;
  for (const c of enabled) {
    cumulativeMinutes += c.delay_minutes;
    await pool.query(
      `INSERT INTO scheduled_followups (conversation_id, step_order, scheduled_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,
      [conversationId, c.step_order, cumulativeMinutes]
    );
  }
}

export async function cancelFollowups(conversationId: string): Promise<void> {
  await pool.query(
    `UPDATE scheduled_followups SET status = 'cancelled' WHERE conversation_id = $1 AND status = 'pending'`,
    [conversationId]
  );
}

export interface ScheduledFollowup {
  id: number;
  conversation_id: string;
  step_order: number;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled';
  sent_at: string | null;
  followup_message: string;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
}

export async function getPendingFollowups(): Promise<ScheduledFollowup[]> {
  const { rows } = await pool.query(
    `SELECT sf.*, fc.message AS followup_message, fc.file_url, fc.file_type, fc.file_name
     FROM scheduled_followups sf
     JOIN followup_configs fc ON fc.step_order = sf.step_order
     WHERE sf.status = 'pending' AND sf.scheduled_at <= NOW()
     ORDER BY sf.scheduled_at ASC LIMIT 50`
  );
  return rows;
}

export async function markFollowupSent(id: number): Promise<void> {
  await pool.query(`UPDATE scheduled_followups SET status = 'sent', sent_at = NOW() WHERE id = $1`, [id]);
}
