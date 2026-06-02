import { NextResponse } from 'next/server';
import { getMediaUrls, createMediaUrl, deleteMediaUrl } from '@/lib/db';

export async function GET() {
  try {
    const items = await getMediaUrls();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[media-urls:get]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, url, type, description } = await req.json();
    if (!name?.trim() || !url?.trim()) return NextResponse.json({ error: 'name and url required' }, { status: 400 });
    const item = await createMediaUrl(name.trim(), url.trim(), type || 'document', description?.trim());
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[media-urls:post]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await deleteMediaUrl(parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media-urls:delete]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
