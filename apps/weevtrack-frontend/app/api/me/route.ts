import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const res = await fetch(`${TRACCAR_URL}/api/session`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const user = await res.json();
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 });
  }
}
