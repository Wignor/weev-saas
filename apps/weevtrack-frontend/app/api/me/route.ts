import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

function getImpersonatedId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (!raw) return null;
    const u = JSON.parse(decodeURIComponent(raw));
    return u.impersonating && u.id ? String(u.id) : null;
  } catch { return null; }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const impersonatedId = getImpersonatedId(cookieStore);
    const url = impersonatedId
      ? `${TRACCAR_URL}/api/users/${impersonatedId}`
      : `${TRACCAR_URL}/api/session`;

    const res = await fetch(url, {
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

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { realEmail } = await req.json();

    const impersonatedId = getImpersonatedId(cookieStore);
    const sessionUrl = impersonatedId
      ? `${TRACCAR_URL}/api/users/${impersonatedId}`
      : `${TRACCAR_URL}/api/session`;

    const getRes = await fetch(sessionUrl, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!getRes.ok) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const user = await getRes.json();

    const putRes = await fetch(`${TRACCAR_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
      body: JSON.stringify({
        ...user,
        attributes: { ...(user.attributes || {}), realEmail: realEmail ?? (user.attributes?.realEmail || '') },
      }),
    });

    const text = await putRes.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /**/ }
    if (!putRes.ok) return NextResponse.json({ error: (data.message as string) || 'Erro ao atualizar e-mail' }, { status: putRes.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
