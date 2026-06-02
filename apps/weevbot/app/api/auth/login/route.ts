import { NextResponse } from 'next/server';
import { createSessionToken, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { getUserByEmail, getUserPasswordHash, getOperatorByEmail, getOperatorPasswordHash } from '@/lib/db';

const COOKIE_OPTS = (prod: boolean) => ({ httpOnly: true, secure: prod, sameSite: 'lax' as const, maxAge: 7 * 24 * 60 * 60, path: '/' });

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const prod = process.env.NODE_ENV === 'production';

    // 1. Env admin
    if (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = await createSessionToken(email, { role: 'admin' });
      const res = NextResponse.json({ ok: true, role: 'admin' });
      res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS(prod));
      return res;
    }

    // 2. DB users (admin)
    const user = await getUserByEmail(email).catch(() => null);
    if (user) {
      const hash = await getUserPasswordHash(email).catch(() => null);
      if (hash && await verifyPassword(password, hash)) {
        const token = await createSessionToken(email, { role: 'admin' });
        const res = NextResponse.json({ ok: true, role: 'admin' });
        res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS(prod));
        return res;
      }
    }

    // 3. Operators
    const operator = await getOperatorByEmail(email).catch(() => null);
    if (operator) {
      const hash = await getOperatorPasswordHash(email).catch(() => null);
      if (hash && await verifyPassword(password, hash)) {
        const token = await createSessionToken(email, { role: 'operator', operatorId: operator.id, sectorId: operator.sector_id });
        const res = NextResponse.json({ ok: true, role: 'operator' });
        res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS(prod));
        return res;
      }
    }

    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
