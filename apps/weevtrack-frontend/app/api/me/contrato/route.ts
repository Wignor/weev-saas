import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'contracts');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weevtrack.com';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let userId: number | null = null;
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) userId = JSON.parse(decodeURIComponent(raw)).id;
  } catch { /* silencioso */ }
  if (!userId) return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 });

  if (!fs.existsSync(DATA_DIR)) return NextResponse.json(null);

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const signed = files
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(c => c && c.userId === userId && c.status === 'signed')
    .sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());

  if (signed.length === 0) return NextResponse.json(null);

  const c = signed[0];
  return NextResponse.json({
    token: c.token,
    signedAt: c.signedAt,
    templateName: c.templateName,
    url: `${APP_URL}/contrato/${c.token}`,
  });
}
