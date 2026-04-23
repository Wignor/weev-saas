import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const res = await fetch(`${TRACCAR_URL}/api/users`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });

  if (res.status === 403) return NextResponse.json({ error: 'Sem permissão de administrador' }, { status: 403 });
  if (!res.ok) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });

  return NextResponse.json(await res.json());
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }

  const res = await fetch(`${TRACCAR_URL}/api/users`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, administrator: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || 'Erro ao criar usuário' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
