import { NextResponse } from 'next/server';
import { getDailyReport } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  try {
    const report = await getDailyReport(date);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
}
