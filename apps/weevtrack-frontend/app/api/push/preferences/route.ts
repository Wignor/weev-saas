import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const PREFS_FILE = path.join(process.cwd(), 'data', 'notification-prefs.json');

const DEFAULT_PREFS = {
  ignitionOn: true,
  ignitionOff: true,
  moving: false,
  overspeed: false,
  lowBattery: false,
};

function readPrefs(): Record<string, typeof DEFAULT_PREFS> {
  try {
    if (!fs.existsSync(PREFS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
  } catch { return {}; }
}

function savePrefs(prefs: Record<string, typeof DEFAULT_PREFS>) {
  const dir = path.dirname(PREFS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
}

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) return String(JSON.parse(decodeURIComponent(raw)).id);
  } catch { /**/ }
  return '';
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = getUserId(cookieStore);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const prefs = readPrefs();
  return NextResponse.json(prefs[userId] ?? DEFAULT_PREFS);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = getUserId(cookieStore);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await req.json();
  const prefs = readPrefs();
  prefs[userId] = { ...DEFAULT_PREFS, ...body };
  savePrefs(prefs);
  return NextResponse.json({ success: true });
}
