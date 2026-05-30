import { createClient } from '@supabase/supabase-js';
import { getSetting } from './db';

const BUCKET = 'weevbot-media';

async function getClient() {
  const [url, key] = await Promise.all([
    getSetting('supabase_url'),
    getSetting('supabase_key'),
  ]);
  if (!url || !key) throw new Error('Supabase não configurado (supabase_url / supabase_key)');
  return createClient(url, key);
}

export async function uploadToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const supabase = await getClient();

  // Create bucket if it doesn't exist (requires service_role key)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return publicUrl;
}

export async function deleteFromStorage(url: string): Promise<void> {
  const supabase = await getClient();
  const parts = url.split('/');
  const fileName = parts[parts.length - 1];
  await supabase.storage.from(BUCKET).remove([fileName]).catch(() => {});
}
