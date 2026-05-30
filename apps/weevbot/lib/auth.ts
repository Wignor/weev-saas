const SESSION_COOKIE = 'wz_session';

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || 'weevzap-change-in-production';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = btoa(Array.from(new Uint8Array(sig), c => String.fromCharCode(c)).join(''));
  return `${btoa(payload)}.${sigB64}`;
}

export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;
    const payloadStr = atob(payloadB64);
    const key = await getKey();
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadStr));
    if (!valid) return null;
    const { email, exp } = JSON.parse(payloadStr);
    if (Date.now() > exp) return null;
    return { email };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
