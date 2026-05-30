import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    return NextResponse.json(await getConversations(tenantId));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
