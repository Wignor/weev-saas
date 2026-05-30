import { NextResponse } from 'next/server';
import { getMediaItems, createMediaItem } from '@/lib/db';
import { uploadToStorage } from '@/lib/media-storage';

export async function GET() {
  try {
    const items = await getMediaItems();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[media:get]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = ((formData.get('name') as string) || '').trim();

    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const publicUrl = await uploadToStorage(buffer, uniqueName, file.type);

    const type =
      file.type.startsWith('video/') ? 'video' :
      file.type.startsWith('image/') ? 'image' :
      file.type.startsWith('audio/') ? 'audio' : 'document';

    const item = await createMediaItem(
      name || file.name,
      type,
      publicUrl,
      file.name,
      file.size,
    );
    return NextResponse.json(item);
  } catch (err) {
    console.error('[media:post]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
