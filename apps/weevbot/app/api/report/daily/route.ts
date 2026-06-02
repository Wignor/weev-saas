import { NextResponse } from 'next/server';
import { getDailyReport } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    const sectorFilter: number | null | undefined =
      session?.role === 'operator' ? (session.sectorId ?? null) : undefined;
    const report = await getDailyReport(date, sectorFilter);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
}
