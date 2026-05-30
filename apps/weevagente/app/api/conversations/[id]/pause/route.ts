import { NextResponse } from 'next/server';
import { updateConversationStatus } from '@/lib/db';
import { redis, KEYS, TTL } from '@/lib/redis';
import { getTenantId } from '@/lib/tenant-context';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenantId = await getTenantId();
    const { action } = await req.json();
    if (action === 'pause') {
      await redis.set(KEYS.atendimento(tenantId, params.id), 'humano', 'EX', TTL.PAUSA_HUMANO);
      await updateConversationStatus(tenantId, params.id, 'paused');
    } else {
      await redis.del(KEYS.atendimento(tenantId, params.id));
      await updateConversationStatus(tenantId, params.id, 'active');
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
