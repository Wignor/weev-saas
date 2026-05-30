import { getConversations } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

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
          try { const convs = await getConversations(tenantId); send({ type: 'conversations', data: convs }); } catch {}
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
