import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { traccarLogout } from '@/lib/traccar';

export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;

  if (session) {
    await traccarLogout(session).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('wt_session');
  response.cookies.delete('wt_user');
  return response;
}
