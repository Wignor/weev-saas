import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, hashPassword, SESSION_COOKIE } from '@/lib/auth';
import { deleteUser, updateUserPassword } from '@/lib/db';

const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL || 'wignor.ferreira@gmail.com';

async function requireAdmin() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session || session.email !== ADMIN_EMAIL()) return null;
  return session;
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  await deleteUser(Number(params.id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { password } = await req.json();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
  }
  const hash = await hashPassword(password);
  await updateUserPassword(Number(params.id), hash);
  return NextResponse.json({ ok: true });
}
