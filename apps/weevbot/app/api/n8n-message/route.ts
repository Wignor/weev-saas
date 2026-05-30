import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { saveMessage, upsertConversation } from '@/lib/db';
import { sendMessage } from '@/lib/evolution';
import { splitIntoBlocks } from '@/lib/message-utils';

export async function POST(req: Request) {
  try {
    const { number, text } = await req.json();
    if (!number || !text?.trim()) {
      return NextResponse.json({ error: 'number and text required' }, { status: 400 });
    }

    const remoteJid = `${number}@s.whatsapp.net`;

    // Mark as system-sending so the fromMe webhook doesn't pause the AI
    await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);

    // Send in blocks (same splitting logic as AI responses)
    const blocks = splitIntoBlocks(text.trim());
    for (let i = 0; i < blocks.length; i++) {
      await sendMessage(remoteJid, blocks[i], i === 0 ? 0 : 1500);
    }

    const msgId = `n8n_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, msgId, 'assistant', text.trim()),
      upsertConversation(number, 'active', text.trim()),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[n8n-message]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
