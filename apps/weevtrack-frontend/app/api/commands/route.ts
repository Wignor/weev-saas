import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { deviceId, type } = await req.json();
  if (!deviceId || !type) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

  const res = await fetch(`${TRACCAR_URL}/api/commands/send`, {
    method: 'POST',
    headers: {
      'Cookie': `JSESSIONID=${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceId, type, textChannel: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err || 'Falha ao enviar comando' }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}
