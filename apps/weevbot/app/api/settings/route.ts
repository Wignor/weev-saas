import { NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';

const HIDDEN_KEYS = new Set(['system_prompt', 'openai_model', 'max_history_messages']);

export async function GET() {
  try {
    const settings = await getAllSettings();
    return NextResponse.json(settings.filter(s => !HIDDEN_KEYS.has(s.key)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json() as { key: string; value: string };
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }
    await setSetting(key, value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
