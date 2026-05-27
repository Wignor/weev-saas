import { NextResponse } from 'next/server';
import { getQuickReplies, createQuickReply } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getQuickReplies());
  } catch (err) {
    console.error('[quick-replies:get]', err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, content } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'title and content required' }, { status: 400 });
    }
    const qr = await createQuickReply(title.trim(), content.trim());
    return NextResponse.json(qr, { status: 201 });
  } catch (err) {
    console.error('[quick-replies:post]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
