import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, hashPassword, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { getTenantPasswordHash, updateTenantPasswordByEmail } from '@/lib/db';

export async function POST(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Senha inválida (mínimo 6 caracteres)' }, { status: 400 });
  }

  const hash = await getTenantPasswordHash(session.email);
  if (!hash) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const ok = await verifyPassword(currentPassword, hash);
  if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });

  const newHash = await hashPassword(newPassword);
  await updateTenantPasswordByEmail(session.email, newHash);
  return NextResponse.json({ ok: true });
}
