import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getMediaItems, createMediaItem, deleteMediaItemById, getTenantStorageUsed } from '@/lib/db';
import { uploadToStorage, deleteFromStorage } from '@/lib/media-storage';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wignor.ferreira@gmail.com';
const STORAGE_LIMIT = 150 * 1024 * 1024; // 150 MB

async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const items = await getMediaItems(session.tenantId);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[media:get]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = ((formData.get('name') as string) || '').trim();

    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });

    if (session.email !== ADMIN_EMAIL) {
      const used = await getTenantStorageUsed(session.tenantId);
      if (used + file.size > STORAGE_LIMIT) {
        return NextResponse.json({ error: 'storage_limit', used, limit: STORAGE_LIMIT }, { status: 413 });
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const publicUrl = await uploadToStorage(buffer, uniqueName, file.type, session.tenantId);

    const type =
      file.type.startsWith('video/') ? 'video' :
      file.type.startsWith('image/') ? 'image' :
      file.type.startsWith('audio/') ? 'audio' : 'document';

    const item = await createMediaItem(
      session.tenantId,
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

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id } = await req.json();
    const url = await deleteMediaItemById(session.tenantId, parseInt(id, 10));
    if (url) deleteFromStorage(url).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media:delete]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
