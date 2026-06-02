import { NextResponse } from 'next/server';
import { getDailyReport } from '@/lib/db';
import { getSession } from '@/lib/tenant-context';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const sectorFilter: number | null | undefined =
      session.role === 'operator' ? (session.sectorId ?? null) : undefined;
    return NextResponse.json(await getDailyReport(session.tenantId, date, sectorFilter));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
