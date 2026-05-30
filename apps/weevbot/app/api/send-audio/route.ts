import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { saveMessage, upsertConversation, getSetting } from '@/lib/db';
import { sendPTTAudio } from '@/lib/evolution';

export async function POST(req: Request) {
  try {
    const { number, audioBase64 } = await req.json();
    if (!number || !audioBase64) {
      return NextResponse.json({ error: 'number and audioBase64 required' }, { status: 400 });
    }

    const remoteJid = `${number}@s.whatsapp.net`;
    const pauseTtl = parseInt((await getSetting('pause_ttl_seconds')) || String(TTL.PAUSA_HUMANO), 10);

    await sendPTTAudio(remoteJid, audioBase64);

    const msgId = `audio_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, msgId, 'human', '🎤 [Áudio enviado pelo atendente]'),
      upsertConversation(number, 'paused', '🎤 Áudio'),
      redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-audio]', err);
    return NextResponse.json({ error: 'failed to send' }, { status: 500 });
  }
}
