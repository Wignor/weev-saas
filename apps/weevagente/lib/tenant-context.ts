import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE, SessionExtra } from './auth';

export async function getSession(): Promise<{ tenantId: string; email: string } & SessionExtra> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error('Unauthorized');
  const payload = await verifySessionToken(token);
  if (!payload) throw new Error('Unauthorized');
  return payload;
}

export async function getTenantId(): Promise<string> {
  return (await getSession()).tenantId;
}

export async function requireAdmin(): Promise<{ tenantId: string; email: string } & SessionExtra> {
  const session = await getSession();
  if (session.role === 'operator') throw new Error('Forbidden');
  return session;
}
