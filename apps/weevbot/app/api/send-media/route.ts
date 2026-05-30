import { NextResponse } from 'next/server';
import { getMediaItem, saveMessage, upsertConversation } from '@/lib/db';
import { sendVideo, sendDocument, sendImage, sendAudio } from '@/lib/evolution';

export async function POST(req: Request) {
  try {
    const { number, mediaId } = await req.json();
    if (!number || !mediaId) {
      return NextResponse.json({ error: 'number and mediaId required' }, { status: 400 });
    }

    const item = await getMediaItem(parseInt(mediaId, 10));
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const remoteJid = `${number}@s.whatsapp.net`;

    if (item.type === 'video') {
      await sendVideo(remoteJid, item.url, item.name);
    } else if (item.type === 'image') {
      await sendImage(remoteJid, item.url, item.name);
    } else if (item.type === 'audio') {
      await sendAudio(remoteJid, item.url);
    } else {
      await sendDocument(remoteJid, item.url, item.file_name);
    }

    // Save media message to conversation history
    const msgContent = `[MEDIA:${item.type}:${item.file_name}] ${item.url}`;
    const msgId = `media_human_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, msgId, 'human', msgContent),
      upsertConversation(number, 'paused', `[Mídia: ${item.name}]`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-media]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
