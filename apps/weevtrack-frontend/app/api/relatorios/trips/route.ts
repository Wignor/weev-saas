import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!deviceId || !from || !to) return NextResponse.json({ error: 'Parâmetros obrigatórios: deviceId, from, to' }, { status: 400 });

  try {
    const res = await fetch(
      `${TRACCAR_URL}/api/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Cookie: `JSESSIONID=${session}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    if (res.status === 401) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    if (!res.ok) return NextResponse.json({ error: `Traccar: ${res.status}` }, { status: 500 });
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
