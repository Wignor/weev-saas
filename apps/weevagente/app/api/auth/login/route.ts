import { NextResponse } from 'next/server';
import { getTenantByEmail, getTenantPasswordHash } from '@/lib/db';
import { verifyPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const tenant = await getTenantByEmail(email);
    if (!tenant) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    if (tenant.status === 'pending_setup') {
      return NextResponse.json({ error: 'Conta ainda não configurada. Verifique seu e-mail.' }, { status: 403 });
    }
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return NextResponse.json({ error: 'Conta suspensa. Verifique seu pagamento.' }, { status: 403 });
    }

    const hash = await getTenantPasswordHash(email);
    if (!hash) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    const ok = await verifyPassword(password, hash);
    if (!ok) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    const token = await createSessionToken(tenant.id, email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
