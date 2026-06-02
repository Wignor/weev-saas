import { getConversations, updateConversationStatus } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';
import { redis, KEYS } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function getConversationsWithAutoResume(tenantId: string) {
  const data = await getConversations(tenantId);
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
  return data;
}

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };
        const iv = setInterval(async () => {
          try {
            const convs = await getConversationsWithAutoResume(tenantId);
            send({ type: 'conversations', data: convs });
          } catch {}
        }, 4000);
        setTimeout(() => { clearInterval(iv); try { controller.close(); } catch {} }, 60000);
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
