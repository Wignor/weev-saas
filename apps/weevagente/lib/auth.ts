import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'wza_session';

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || 'weevagente-change-in-production';
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export interface SessionExtra {
  role?: 'admin' | 'operator';
  operatorId?: number;
  sectorId?: number | null;
}

export async function createSessionToken(tenantId: string, email: string, extra?: SessionExtra): Promise<string> {
  const payload = JSON.stringify({ tenantId, email, ...extra, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = btoa(Array.from(new Uint8Array(sig), c => String.fromCharCode(c)).join(''));
  return `${btoa(payload)}.${sigB64}`;
}

export async function verifySessionToken(token: string): Promise<{ tenantId: string; email: string } & SessionExtra | null> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;
    const payloadStr = atob(payloadB64);
    const key = await getKey();
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadStr));
    if (!valid) return null;
    const { tenantId, email, exp, role, operatorId, sectorId } = JSON.parse(payloadStr);
    if (Date.now() > exp) return null;
    return { tenantId, email, role, operatorId, sectorId };
  } catch { return null; }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
