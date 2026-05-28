import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const adminUserRaw = cookieStore.get('wt_admin_user')?.value;

  if (!adminUserRaw) {
    return NextResponse.json({ error: 'Sem sessão de impersonificação' }, { status: 400 });
  }

  let adminUser: unknown;
  try {
    adminUser = JSON.parse(decodeURIComponent(adminUserRaw));
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const secure   = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ success: true });

  response.cookies.set('wt_user', JSON.stringify(adminUser), {
    httpOnly: false, secure, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
  });
  response.cookies.delete('wt_admin_user');

  return response;
}
