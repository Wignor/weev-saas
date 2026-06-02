import { NextResponse } from 'next/server';
import { deleteSector } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const tenantId = await getTenantId();
    await deleteSector(tenantId, parseInt(params.id));
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
