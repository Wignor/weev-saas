import { NextResponse } from 'next/server';
import { deleteQuickReply } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteQuickReply(parseInt(params.id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[quick-replies:delete]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
