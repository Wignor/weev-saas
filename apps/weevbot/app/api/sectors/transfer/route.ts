import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { transferConversationSector } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { conversationId, toSectorId } = await req.json();
    if (!conversationId || !toSectorId) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    await transferConversationSector(conversationId, parseInt(toSectorId), session.email);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
