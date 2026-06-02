import { NextResponse } from 'next/server';
import { transferConversationSector } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { conversationId, toSectorId, note } = await req.json();
    if (!conversationId || !toSectorId) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    await transferConversationSector(tenantId, conversationId, parseInt(toSectorId), undefined, note);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
