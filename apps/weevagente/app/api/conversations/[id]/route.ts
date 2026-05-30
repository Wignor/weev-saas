import { NextResponse } from 'next/server';
import { getConversation, getMessages, deleteConversation } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const tenantId = await getTenantId();
    const [conversation, messages] = await Promise.all([getConversation(tenantId, params.id), getMessages(tenantId, params.id)]);
    if (!conversation) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ conversation, messages });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const tenantId = await getTenantId();
    await deleteConversation(tenantId, params.id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
