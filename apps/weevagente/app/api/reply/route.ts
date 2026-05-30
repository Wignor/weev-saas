import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { saveMessage, upsertConversation, getTenantById } from '@/lib/db';
import { sendMessage } from '@/lib/evolution';
import { getTenantId } from '@/lib/tenant-context';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { number, text } = await req.json();
    if (!number || !text?.trim()) return NextResponse.json({ error: 'number and text required' }, { status: 400 });

    const tenant = await getTenantById(tenantId);
    if (!tenant?.evolution_instance) return NextResponse.json({ error: 'WhatsApp não conectado' }, { status: 400 });

    const remoteJid = `${number}@s.whatsapp.net`;
    const pauseTtl = TTL.PAUSA_HUMANO;

    await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);
    await sendMessage(tenant.evolution_instance, remoteJid, text.trim(), 0);
    await redis.set(KEYS.atendimento(tenantId, number), 'humano', 'EX', pauseTtl);

    const msgId = `human_reply_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(tenantId, number, msgId, 'human', text.trim()),
      upsertConversation(tenantId, number, 'paused', text.trim()),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
