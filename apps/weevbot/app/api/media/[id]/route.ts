import { NextResponse } from 'next/server';
import { deleteMediaItemById } from '@/lib/db';
import { deleteFromStorage } from '@/lib/media-storage';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = await deleteMediaItemById(parseInt(params.id, 10));
    if (url) await deleteFromStorage(url).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media:delete]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
