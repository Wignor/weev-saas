import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { saveMessage, upsertConversation, getSetting } from '@/lib/db';
import { sendMessage } from '@/lib/evolution';

export async function POST(req: Request) {
  try {
    const { number, text } = await req.json();
    if (!number || !text?.trim()) {
      return NextResponse.json({ error: 'number and text required' }, { status: 400 });
    }

    const remoteJid = `${number}@s.whatsapp.net`;
    await sendMessage(remoteJid, text.trim());

    const msgId = `human_${number}_${Date.now()}`;
    const pauseTtl = parseInt(
      (await getSetting('pause_ttl_seconds')) || String(TTL.PAUSA_HUMANO), 10
    );

    await Promise.all([
      saveMessage(number, msgId, 'human', text.trim()),
      upsertConversation(number, 'paused', text.trim()),
      redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reply]', err);
    return NextResponse.json({ error: 'failed to send' }, { status: 500 });
  }
}
