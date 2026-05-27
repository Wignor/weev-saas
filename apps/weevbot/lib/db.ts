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

export async function getConversationHistory(number: string, limit = 20): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [number, limit]
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
    `UPDATE settings SET value = $1 WHERE key = $2`,
    [value, key]
  );
}
