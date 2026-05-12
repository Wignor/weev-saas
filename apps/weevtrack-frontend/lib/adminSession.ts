import fs from 'fs';
import path from 'path';

const SESSION_CACHE = path.join(process.cwd(), 'data', 'admin_session.cache');

function traccarUrl() { return process.env.TRACCAR_URL || 'http://localhost:8082'; }

function readCached(): string {
  try { return fs.readFileSync(SESSION_CACHE, 'utf-8').trim(); } catch { return ''; }
}

function writeCached(sessionId: string) {
  try {
    const dir = path.dirname(SESSION_CACHE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_CACHE, sessionId, 'utf-8');
  } catch { /**/ }
}

async function isSessionValid(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const res = await fetch(`${traccarUrl()}/api/session`, {
      headers: { Cookie: `JSESSIONID=${sessionId}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch { return false; }
}

async function loginAdmin(): Promise<string> {
  // Read at call time so runtime env vars are always used
  const email    = process.env.TRACCAR_ADMIN_EMAIL    || '';
  const password = process.env.TRACCAR_ADMIN_PASSWORD || '';
  if (!email || !password) return '';
  try {
    const res = await fetch(`${traccarUrl()}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }),
    });
    if (!res.ok) return '';
    const cookie = res.headers.get('set-cookie') || '';
    const match  = cookie.match(/JSESSIONID=([^;]+)/);
    return match?.[1] || '';
  } catch { return ''; }
}

// Returns a valid admin JSESSIONID, refreshing automatically if expired.
export async function getAdminSessionId(): Promise<string> {
  const cached = readCached();
  if (await isSessionValid(cached)) return cached;

  const fresh = await loginAdmin();
  if (fresh) writeCached(fresh);
  return fresh;
}

export function adminHeaders(sessionId: string) {
  return {
    Cookie: `JSESSIONID=${sessionId}`,
    'Content-Type': 'application/json',
  };
}
