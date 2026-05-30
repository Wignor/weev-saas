import { NextResponse } from 'next/server';
import { getQuickReplies, createQuickReply } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try { const tid = await getTenantId(); return NextResponse.json(await getQuickReplies(tid)); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
export async function POST(req: Request) {
  try { const tid = await getTenantId(); const { title, content } = await req.json(); return NextResponse.json(await createQuickReply(tid, title, content)); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
