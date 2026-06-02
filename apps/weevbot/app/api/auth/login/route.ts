import { NextResponse } from 'next/server';
import { createSessionToken, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { getUserByEmail, getUserPasswordHash } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // 1. Check env admin credentials first
    if (adminEmail && email === adminEmail && password === adminPassword) {
      const token = await createSessionToken(email);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
      return res;
    }

    // 2. Check DB users
    const user = await getUserByEmail(email).catch(() => null);
    if (!user) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    const hash = await getUserPasswordHash(email).catch(() => null);
    if (!hash) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    const ok = await verifyPassword(password, hash);
    if (!ok) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });

    const token = await createSessionToken(email);
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
