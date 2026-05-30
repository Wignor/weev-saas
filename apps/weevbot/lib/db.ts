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
