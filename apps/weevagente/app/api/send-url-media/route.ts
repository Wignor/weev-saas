import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getTenantById, saveMessage, upsertConversation } from '@/lib/db';

const BASE = process.env.EVOLUTION_API_URL || 'https://api.weevzap.pro';
const KEY  = process.env.EVOLUTION_API_KEY  || '';

export async function POST(req: Request) {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const session = await verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenant = await getTenantById(session.tenantId);
    if (!tenant?.evolution_instance) return NextResponse.json({ error: 'no instance' }, { status: 400 });

    const { number, url, type, name } = await req.json();
    if (!number || !url) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const mediatype = type || 'document';
    const payload: Record<string, unknown> = {
      number,
      mediatype,
      media: url,
    };
    if (mediatype === 'document') payload.fileName = name || 'arquivo';

    const res = await fetch(`${BASE}/message/sendMedia/${encodeURIComponent(tenant.evolution_instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[send-url-media]', err);
      return NextResponse.json({ error: 'evolution error' }, { status: 500 });
    }

    const msgId = `media_human_${number}_${Date.now()}`;
    const content = `[MEDIA:${mediatype}:${name}] ${url}`;
    await Promise.all([
      saveMessage(session.tenantId, number, msgId, 'human', content),
      upsertConversation(session.tenantId, number, 'paused', `[Midia: ${name}]`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-url-media]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
