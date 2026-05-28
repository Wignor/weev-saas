import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const AVATARS_FILE = path.join(process.cwd(), 'data', 'user-avatars.json');

function readAvatars(): Record<string, string> {
  try {
    if (!fs.existsSync(AVATARS_FILE)) return {};
    return JSON.parse(fs.readFileSync(AVATARS_FILE, 'utf-8'));
  } catch { return {}; }
}

function writeAvatars(data: Record<string, string>) {
  const dir = path.dirname(AVATARS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AVATARS_FILE, JSON.stringify(data));
}

async function resolveUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<number | null> {
  // When impersonating, use the client's ID from wt_user cookie
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) {
      const u = JSON.parse(decodeURIComponent(raw));
      if (u.impersonating && u.id) return Number(u.id);
    }
  } catch { /**/ }

  // Normal: resolve via Traccar session
  try {
    const session = cookieStore.get('wt_session')?.value;
    if (!session) return null;
    const res = await fetch(`${TRACCAR_URL}/api/session`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()).id ?? null;
  } catch { return null; }
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = await resolveUserId(cookieStore);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const avatars = readAvatars();
  return NextResponse.json({ avatar: avatars[String(userId)] || null });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = await resolveUserId(cookieStore);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { avatar } = await req.json();
  if (!avatar || !String(avatar).startsWith('data:image/')) {
    return NextResponse.json({ error: 'Formato de imagem inválido' }, { status: 400 });
  }
  if (String(avatar).length > 700_000) {
    return NextResponse.json({ error: 'Imagem muito grande (máx. 500 KB)' }, { status: 400 });
  }

  const avatars = readAvatars();
  avatars[String(userId)] = String(avatar);
  writeAvatars(avatars);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const userId = await resolveUserId(cookieStore);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const avatars = readAvatars();
  delete avatars[String(userId)];
  writeAvatars(avatars);
  return NextResponse.json({ ok: true });
}
