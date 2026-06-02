import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { deleteSector } from '@/lib/db';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session || session.role === 'operator') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await deleteSector(parseInt(params.id));
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
