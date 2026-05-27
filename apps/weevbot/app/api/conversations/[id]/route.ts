import { NextResponse } from 'next/server';
import { getConversation, getMessages } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const [conversation, messages] = await Promise.all([
      getConversation(id),
      getMessages(id),
    ]);
    if (!conversation) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ conversation, messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
