import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './auth';

export async function getTenantId(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error('Unauthorized');
  const payload = await verifySessionToken(token);
  if (!payload) throw new Error('Unauthorized');
  return payload.tenantId;
}
