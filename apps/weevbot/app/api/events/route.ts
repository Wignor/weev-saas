import { getConversations, updateConversationStatus } from '@/lib/db';
import { redis, KEYS } from '@/lib/redis';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getConversationsWithAutoResume(sectorFilter: number | null | undefined) {
  const data = await getConversations(sectorFilter);
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
  return data;
}

export async function GET(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const sectorFilter: number | null | undefined =
    session?.role === 'operator' ? (session.sectorId ?? null) : undefined;

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;
  let heartbeatId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch {}
      };

      const initial = await getConversationsWithAutoResume(sectorFilter).catch(() => []);
      send('conversations', initial);

      intervalId = setInterval(async () => {
        const convs = await getConversationsWithAutoResume(sectorFilter).catch(() => null);
        if (convs) send('conversations', convs);
      }, 2000);

      heartbeatId = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch {}
      }, 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        clearInterval(heartbeatId);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      clearInterval(intervalId);
      clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
