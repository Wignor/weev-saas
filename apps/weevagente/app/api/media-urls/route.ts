import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getMediaUrls, createMediaUrl, deleteMediaUrl } from '@/lib/db';

async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const items = await getMediaUrls(session.tenantId);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[media-urls:get]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { name, url, type, description } = await req.json();
    if (!name?.trim() || !url?.trim()) return NextResponse.json({ error: 'name and url required' }, { status: 400 });
    const item = await createMediaUrl(session.tenantId, name.trim(), url.trim(), type || 'document', description?.trim());
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[media-urls:post]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id } = await req.json();
    await deleteMediaUrl(session.tenantId, parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media-urls:delete]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
