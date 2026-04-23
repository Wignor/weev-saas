import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId') || '';

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 dias

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
    ...(deviceId ? { deviceId } : {}),
  });

  try {
    const res = await fetch(`${TRACCAR_URL}/api/reports/events?${params}`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
