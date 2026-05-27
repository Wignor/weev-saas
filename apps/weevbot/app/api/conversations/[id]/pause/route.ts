import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { updateConversationStatus } from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id: number } = params;
    const { action } = await req.json() as { action: 'pause' | 'resume' };

    if (action === 'pause') {
      await redis.set(KEYS.atendimento(number), 'humano', 'EX', TTL.PAUSA_HUMANO);
      await updateConversationStatus(number, 'paused');
      return NextResponse.json({ ok: true, status: 'paused' });
    }

    if (action === 'resume') {
      await redis.del(KEYS.atendimento(number));
      await updateConversationStatus(number, 'active');
      return NextResponse.json({ ok: true, status: 'active' });
    }

    return NextResponse.json({ error: 'action must be "pause" or "resume"' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
