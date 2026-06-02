import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, hashPassword, SESSION_COOKIE } from '@/lib/auth';
import { getUsers, createUser, getUserByEmail } from '@/lib/db';

const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL || 'wignor.ferreira@gmail.com';

async function requireAdmin() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session || session.email !== ADMIN_EMAIL()) return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const users = await getUsers();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { email, name, password } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'E-mail e senha (mín. 6 chars) são obrigatórios' }, { status: 400 });
  }
  const existing = await getUserByEmail(email);
  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
  const hash = await hashPassword(password);
  const user = await createUser(email, name || '', hash);
  return NextResponse.json(user, { status: 201 });
}
