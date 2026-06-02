import { NextResponse } from 'next/server';
import { getConversations, updateConversationStatus } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { redis, KEYS } from '@/lib/redis';

export async function GET() {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    const sectorFilter = session?.role === 'operator' ? session.sectorId : undefined;
    const data = await getConversations(sectorFilter);

    // Auto-reactivate: if a paused conversation's Redis key has expired, resume AI
    const paused = data.filter(c => c.status === 'paused');
    if (paused.length) {
      await Promise.all(paused.map(async c => {
        const state = await redis.get(KEYS.atendimento(c.id));
        if (state !== 'humano') {
          c.status = 'active';
          updateConversationStatus(c.id, 'active').catch(() => {});
        }
      }));
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
