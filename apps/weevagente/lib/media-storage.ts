import { createClient } from '@supabase/supabase-js';

const BUCKET = 'weevagente-media';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado (SUPABASE_URL / SUPABASE_KEY)');
  return createClient(url, key);
}

export async function uploadToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  tenantId: string
): Promise<string> {
  const supabase = getClient();
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const path = `${tenantId}/${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

export async function deleteFromStorage(url: string): Promise<void> {
  const supabase = getClient();
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const path = url.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}
