import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  const userRaw = cookieStore.get('wt_user')?.value;

  if (!session || !userRaw) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let user: { id: number; email: string };
  try { user = JSON.parse(decodeURIComponent(userRaw)); } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
  if (newPassword.length < 6)
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });

  // Verify current password via Traccar login
  const verifyRes = await fetch(`${TRACCAR_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: user.email, password: currentPassword }),
  });
  if (!verifyRes.ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });

  // Cleanup temp session
  const tempCookie = verifyRes.headers.get('set-cookie') || '';
  const tempId = tempCookie.match(/JSESSIONID=([^;]+)/)?.[1];
  if (tempId) fetch(`${TRACCAR_URL}/api/session`, { method: 'DELETE', headers: { Cookie: `JSESSIONID=${tempId}` } }).catch(() => {});

  // Fetch current user data to preserve all fields
  const userRes = await fetch(`${TRACCAR_URL}/api/users/${user.id}`, {
    headers: { Cookie: `JSESSIONID=${session}` },
  });
  if (!userRes.ok) return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
  const userData = await userRes.json();

  // Update password
  const updateRes = await fetch(`${TRACCAR_URL}/api/users/${user.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
    body: JSON.stringify({ ...userData, password: newPassword }),
  });

  if (!updateRes.ok) return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 });
  return NextResponse.json({ success: true });
}
