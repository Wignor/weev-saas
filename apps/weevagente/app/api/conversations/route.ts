import { NextResponse } from 'next/server';
import { getConversations, updateConversationStatus } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';
import { redis, KEYS } from '@/lib/redis';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const data = await getConversations(tenantId);

    // Auto-reactivate: if a paused conversation's Redis key has expired, resume AI
    const paused = data.filter(c => c.status === 'paused');
    if (paused.length) {
      await Promise.all(paused.map(async c => {
        const state = await redis.get(KEYS.atendimento(tenantId, c.id));
        if (state !== 'humano') {
          c.status = 'active';
          updateConversationStatus(tenantId, c.id, 'active').catch(() => {});
        }
      }));
    }

    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
