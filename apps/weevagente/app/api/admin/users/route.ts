import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, hashPassword, SESSION_COOKIE } from '@/lib/auth';
import { getAllTenants, createTenantDirect, getTenantByEmail } from '@/lib/db';

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
  const tenants = await getAllTenants();
  return NextResponse.json(tenants);
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { email, name, password, evolutionInstance } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'E-mail e senha (mín. 6 chars) são obrigatórios' }, { status: 400 });
  }
  const existing = await getTenantByEmail(email);
  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
  const hash = await hashPassword(password);
  const tenant = await createTenantDirect(email, name || '', hash, evolutionInstance || '');
  return NextResponse.json(tenant, { status: 201 });
}
