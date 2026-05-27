import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSetting } from './db';

let _client: SupabaseClient | null = null;
let _clientKey = '';

async function getClient(): Promise<SupabaseClient | null> {
  const [url, key] = await Promise.all([
    getSetting('supabase_url'),
    getSetting('supabase_key'),
  ]);
  if (!url || !key) return null;
  const cacheKey = `${url}:${key}`;
  if (_client && _clientKey === cacheKey) return _client;
  _client = createClient(url, key);
  _clientKey = cacheKey;
  return _client;
}

export type ContactStatus =
  | 'pendente_classificacao'
  | 'lead'
  | 'cliente'
  | 'inquilino'
  | 'pc1_enviado'
  | 'pc2_enviado'
  | string;

export interface Contact {
  id: number;
  nome: string;
  telefone: string;
  status: ContactStatus | null;
  ultimo_contato: string | null;
  instance: string | null;
  atualizado_em: string | null;
}

// Fetch contact from Supabase by phone number
export async function getContact(number: string): Promise<Contact | null> {
  try {
    const supabase = await getClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from('contatos')
      .select('*')
      .eq('telefone', number)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

// Insert new contact as pendente_classificacao
export async function insertNewContact(
  number: string,
  pushName: string | undefined,
  instance: string
): Promise<void> {
  try {
    const supabase = await getClient();
    if (!supabase) return;
    const now = new Date().toISOString();
    await supabase.from('contatos').insert({
      telefone: number,
      nome: pushName || number,
      status: 'pendente_classificacao',
      ultimo_contato: now,
      instance,
      atualizado_em: now,
    });
  } catch (err) {
    console.error('[contacts:insert]', err);
  }
}

// Update contact status (e.g. lead, cliente)
export async function setContactStatus(
  number: string,
  status: ContactStatus,
  pushName?: string
): Promise<void> {
  try {
    const supabase = await getClient();
    if (!supabase) return;
    const now = new Date().toISOString();
    const update: Record<string, string> = { status, ultimo_contato: now, atualizado_em: now };
    if (pushName) update.nome = pushName;
    await supabase.from('contatos').update(update).eq('telefone', number);
  } catch (err) {
    console.error('[contacts:setStatus]', err);
  }
}

// Touch contact timestamps on each message
export async function touchContact(number: string, pushName?: string): Promise<void> {
  try {
    const supabase = await getClient();
    if (!supabase) return;
    const now = new Date().toISOString();
    const update: Record<string, string> = { ultimo_contato: now, atualizado_em: now };
    if (pushName) update.nome = pushName;
    await supabase.from('contatos').update(update).eq('telefone', number);
  } catch (err) {
    console.error('[contacts:touch]', err);
  }
}
