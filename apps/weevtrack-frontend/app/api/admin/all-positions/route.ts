import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL   = process.env.TRACCAR_URL || 'http://localhost:8082';
const SESSION_CACHE = path.join(process.cwd(), 'data', 'admin_session.cache');

function adminSession(): string {
  try { return fs.readFileSync(SESSION_CACHE, 'utf-8').trim(); } catch { return ''; }
}

async function verifyAdmin(session: string): Promise<boolean> {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  if (!res.ok) return false;
  const user = await res.json();
  return user.administrator === true;
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!await verifyAdmin(session)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const r = await fetch(`${TRACCAR_URL}/api/positions`, {
    headers: { Cookie: `JSESSIONID=${adminSession()}` }, cache: 'no-store',
  });
  if (!r.ok) return NextResponse.json({ error: 'Erro ao buscar posições' }, { status: 500 });
  return NextResponse.json(await r.json());
}
