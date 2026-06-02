import { NextResponse } from 'next/server';
import { deleteOperator } from '@/lib/db';
import { requireAdmin } from '@/lib/tenant-context';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireAdmin();
    await deleteOperator(tenantId, parseInt(params.id));
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
