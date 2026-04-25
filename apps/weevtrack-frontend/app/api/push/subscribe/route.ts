import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const SUBS_FILE = path.join(process.cwd(), 'data', 'subscriptions.json');

function readSubs(): object[] {
  try {
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveSubs(subs: object[]) {
  const dir = path.dirname(SUBS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('wt_session')?.value) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let userId = 0;
  let administrator = false;
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) {
      const u = JSON.parse(decodeURIComponent(raw));
      userId = u.id ?? 0;
      administrator = !!u.administrator;
    }
  } catch { /**/ }

  const sub = await req.json();
  if (!sub?.endpoint) return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 });

  const subs = readSubs() as Array<{ endpoint: string }>;
  const existing = subs.findIndex((s) => s.endpoint === sub.endpoint);
  const enriched = { ...sub, userId, administrator };
  if (existing === -1) {
    subs.push(enriched);
  } else {
    subs[existing] = enriched;
  }
  saveSubs(subs);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = await req.json();
  const subs = readSubs() as Array<{ endpoint: string }>;
  saveSubs(subs.filter((s) => s.endpoint !== endpoint));
  return NextResponse.json({ success: true });
}
