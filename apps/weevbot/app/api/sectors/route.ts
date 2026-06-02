import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getSectors, createSector } from '@/lib/db';

async function requireAdmin() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.role === 'operator') throw new Error('Forbidden');
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getSectors());
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    const sector = await createSector(name.trim(), description?.trim());
    return NextResponse.json(sector, { status: 201 });
  } catch (err) {
    const msg = String(err);
    return NextResponse.json({ error: msg.includes('Forbidden') ? 'Forbidden' : String(err) }, { status: msg.includes('Forbidden') ? 403 : 500 });
  }
}
