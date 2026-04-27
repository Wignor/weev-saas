import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('wt_session');
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isApiRoute = pathname.startsWith('/api');
  const isPublicPage = pathname.startsWith('/contrato');

  if (isApiRoute || isPublicPage) return NextResponse.next();

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|ttf)).*)'],
};
