import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const DEFAULT_PASSWORD = 'as123456';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  const userRaw = cookieStore.get('wt_user')?.value;

  if (!session || !userRaw) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let admin: { administrator: boolean };
  try { admin = JSON.parse(decodeURIComponent(userRaw)); } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (!admin.administrator) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { id } = await params;

  // Fetch current user data to preserve all fields
  const userRes = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    headers: { Cookie: `JSESSIONID=${session}` },
  });
  if (!userRes.ok) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const userData = await userRes.json();

  // Reset password to default
  const updateRes = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
    body: JSON.stringify({ ...userData, password: DEFAULT_PASSWORD }),
  });

  if (!updateRes.ok) return NextResponse.json({ error: 'Erro ao resetar senha' }, { status: 500 });
  return NextResponse.json({ success: true });
}
