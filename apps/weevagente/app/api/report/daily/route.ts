import { NextResponse } from 'next/server';
import { getDailyReport } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    return NextResponse.json(await getDailyReport(tenantId, date));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
