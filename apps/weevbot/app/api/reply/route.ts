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

    const [pauseTtlStr, sigEnabled, sigText] = await Promise.all([
      getSetting('pause_ttl_seconds'),
      getSetting('signature_enabled'),
      getSetting('signature_text'),
    ]);

    const finalText = (sigEnabled === 'true' && sigText?.trim())
      ? `${text.trim()}\n\n_${sigText.trim()}_`
      : text.trim();

    const remoteJid = `${number}@s.whatsapp.net`;
    await sendMessage(remoteJid, finalText);

    const msgId = `human_${number}_${Date.now()}`;
    const pauseTtl = parseInt(pauseTtlStr || String(TTL.PAUSA_HUMANO), 10);

    await Promise.all([
      saveMessage(number, msgId, 'human', finalText),
      upsertConversation(number, 'paused', finalText),
      redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reply]', err);
    return NextResponse.json({ error: 'failed to send' }, { status: 500 });
  }
}
