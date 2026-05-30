import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { saveMessage, upsertConversation, getTenantById, getTenantInstances } from '@/lib/db';
import { sendPTTAudio } from '@/lib/evolution';
import { getTenantId } from '@/lib/tenant-context';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { number, audioBase64 } = await req.json();
    if (!number || !audioBase64) return NextResponse.json({ error: 'number and audioBase64 required' }, { status: 400 });

    const tenant = await getTenantById(tenantId);
    let instance = tenant?.evolution_instance;
    if (!instance) {
      const instances = await getTenantInstances(tenantId);
      instance = instances[0]?.instance_name ?? null;
    }
    if (!instance) return NextResponse.json({ error: 'WhatsApp não conectado' }, { status: 400 });

    const remoteJid = `${number}@s.whatsapp.net`;
    await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);
    await sendPTTAudio(instance, remoteJid, audioBase64);
    await redis.set(KEYS.atendimento(tenantId, number), 'humano', 'EX', TTL.PAUSA_HUMANO);

    const msgId = `audio_reply_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(tenantId, number, msgId, 'human', '🎤 [Áudio enviado pelo atendente]'),
      upsertConversation(tenantId, number, 'paused', '🎤 Áudio'),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
