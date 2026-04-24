import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TraccarPosition } from '@/lib/traccar';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const asUser = req.nextUrl.searchParams.get('asUser');
  const url = asUser
    ? `${TRACCAR_URL}/api/positions?userId=${asUser}`
    : `${TRACCAR_URL}/api/positions`;

  try {
    const res = await fetch(url, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `Traccar ${res.status}` }, { status: res.status });
    const positions: TraccarPosition[] = await res.json();
    return NextResponse.json(positions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}
