import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

const PUBLIC = ['/login', '/setup', '/api/setup', '/api/auth', '/api/kiwify', '/api/webhook', '/_next', '/favicon', '/icon'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  const payload = await verifySessionToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }

  // Pass tenantId via header for API routes
  const res = NextResponse.next();
  res.headers.set('x-tenant-id', payload.tenantId);
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
