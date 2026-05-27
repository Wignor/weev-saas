import { getConversations } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;
  let heartbeatId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        } catch {
          // client disconnected
        }
      };

      // Send initial data immediately
      const initial = await getConversations().catch(() => []);
      send('conversations', initial);

      // Push updates every 2s
      intervalId = setInterval(async () => {
        const convs = await getConversations().catch(() => null);
        if (convs) send('conversations', convs);
      }, 2000);

      // Heartbeat every 25s to keep connection alive through proxies
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {}
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
