import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getTenantById, getMediaItem, saveMessage, upsertConversation } from '@/lib/db';
import { sendVideo, sendDocument, sendImage } from '@/lib/evolution';

export async function POST(req: Request) {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const session = await verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { number, mediaId } = await req.json();
    if (!number || !mediaId) return NextResponse.json({ error: 'number and mediaId required' }, { status: 400 });

    const tenant = await getTenantById(session.tenantId);
    if (!tenant?.evolution_instance) return NextResponse.json({ error: 'no instance' }, { status: 400 });

    const item = await getMediaItem(session.tenantId, parseInt(mediaId, 10));
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const remoteJid = `${number}@s.whatsapp.net`;
    const instance = tenant.evolution_instance;

    if (item.type === 'video') {
      await sendVideo(instance, remoteJid, item.url, item.name);
    } else if (item.type === 'image') {
      await sendImage(instance, remoteJid, item.url, item.name);
    } else {
      await sendDocument(instance, remoteJid, item.url, item.file_name);
    }

    const msgContent = `[MEDIA:${item.type}:${item.file_name}] ${item.url}`;
    const msgId = `media_human_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(session.tenantId, number, msgId, 'human', msgContent),
      upsertConversation(session.tenantId, number, 'paused', `[Midia: ${item.name}]`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-media]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
