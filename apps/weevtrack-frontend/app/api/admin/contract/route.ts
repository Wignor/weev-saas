import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { CONTRACT_BASE_DEFAULT } from '@/lib/contracts';

const CONTRACT_FILE = path.join(process.cwd(), 'data', 'contract_base.txt');

async function checkAuth() {
  const cookieStore = await cookies();
  return !!cookieStore.get('wt_session')?.value;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const text = fs.existsSync(CONTRACT_FILE)
      ? fs.readFileSync(CONTRACT_FILE, 'utf-8')
      : CONTRACT_BASE_DEFAULT;
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: CONTRACT_BASE_DEFAULT });
  }
}

export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { text } = await req.json();
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Texto do contrato obrigatório' }, { status: 400 });
  }
  const dir = path.dirname(CONTRACT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONTRACT_FILE, text, 'utf-8');
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (fs.existsSync(CONTRACT_FILE)) fs.unlinkSync(CONTRACT_FILE);
  return NextResponse.json({ ok: true, text: CONTRACT_BASE_DEFAULT });
}
