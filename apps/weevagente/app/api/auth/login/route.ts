import { NextResponse } from 'next/server';
import { getTenantByEmail, getTenantPasswordHash, getOperatorByEmail, getOperatorPasswordHash } from '@/lib/db';
import { verifyPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    // 1. Try tenant admin login
    const tenant = await getTenantByEmail(email).catch(() => null);
    if (tenant) {
      if (tenant.status === 'pending_setup') return NextResponse.json({ error: 'Conta ainda não configurada.' }, { status: 403 });
      if (tenant.status === 'suspended' || tenant.status === 'cancelled') return NextResponse.json({ error: 'Conta suspensa.' }, { status: 403 });
      const hash = await getTenantPasswordHash(email).catch(() => null);
      if (!hash) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
      const ok = await verifyPassword(password, hash);
      if (!ok) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
      const token = await createSessionToken(tenant.id, email, { role: 'admin' });
      const res = NextResponse.json({ ok: true, role: 'admin' });
      res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' });
      return res;
    }

    // 2. Try operator login
    const operator = await getOperatorByEmail(email).catch(() => null);
    if (!operator) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    const hash = await getOperatorPasswordHash(email).catch(() => null);
    if (!hash) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    const ok = await verifyPassword(password, hash);
    if (!ok) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    const token = await createSessionToken(operator.tenant_id, email, { role: 'operator', operatorId: operator.id, sectorId: operator.sector_id });
    const res = NextResponse.json({ ok: true, role: 'operator' });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
