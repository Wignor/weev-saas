import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';

export async function GET() {
  try {
    const data = await getConversations();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
