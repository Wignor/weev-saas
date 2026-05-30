import { NextResponse } from 'next/server';
import { deleteQuickReply } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try { const tid = await getTenantId(); await deleteQuickReply(tid, parseInt(params.id)); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
