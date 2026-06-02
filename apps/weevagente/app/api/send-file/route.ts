import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getTenantById, saveMessage, upsertConversation } from '@/lib/db';

const BASE = process.env.EVOLUTION_API_URL || 'https://api.weevzap.pro';
const KEY  = process.env.EVOLUTION_API_KEY || '';

function mimeToMediatype(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export async function POST(req: Request) {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const session = await verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenant = await getTenantById(session.tenantId);
    if (!tenant?.evolution_instance) return NextResponse.json({ error: 'no instance' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const number = formData.get('number') as string | null;
    if (!file || !number) return NextResponse.json({ error: 'missing file or number' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'application/octet-stream';
    const fileName = file.name;
    const mediatype = mimeToMediatype(mimeType);

    const payload: Record<string, unknown> = {
      number,
      mediatype,
      mimetype: mimeType,
      media: base64,
    };
    if (mediatype === 'document') payload.fileName = fileName;

    const instance = tenant.evolution_instance;
    const res = await fetch(`${BASE}/message/sendMedia/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[send-file] evolution error', err);
      return NextResponse.json({ error: 'evolution api error' }, { status: 500 });
    }

    const msgId = `human_file_${number}_${Date.now()}`;
    const content = `[MEDIA:${mediatype}:${fileName}] (arquivo direto)`;
    await Promise.all([
      saveMessage(session.tenantId, number, msgId, 'human', content),
      upsertConversation(session.tenantId, number, 'paused', `[Arquivo: ${fileName}]`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-file]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
