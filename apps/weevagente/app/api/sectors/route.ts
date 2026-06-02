import { NextResponse } from 'next/server';
import { getSectors, createSector } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    return NextResponse.json(await getSectors(tenantId));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    const sector = await createSector(tenantId, name.trim(), description?.trim());
    return NextResponse.json(sector);
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
