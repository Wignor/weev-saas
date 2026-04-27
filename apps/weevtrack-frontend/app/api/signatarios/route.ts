import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_FILE = path.join(process.cwd(), 'data', 'signatarios.json');

const DEFAULT_SIGNATORY = {
  id: 'sig_default',
  name: 'Wignor Aguiller Ferreira',
  cpf: '398.000.258-63',
  company: 'Weev Consultoria e Serviços Ltda',
  cnpj: '34.266.884/0001-42',
  isDefault: true,
};

function readSignatories() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [DEFAULT_SIGNATORY];
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    return Array.isArray(data) && data.length > 0 ? data : [DEFAULT_SIGNATORY];
  } catch { return [DEFAULT_SIGNATORY]; }
}

function writeSignatories(data: object[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function checkAuth() {
  const cookieStore = await cookies();
  return !!cookieStore.get('wt_session')?.value;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  return NextResponse.json(readSignatories());
}

export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await req.json();
  const { name, cpf, company, cnpj } = body;
  if (!name || !cpf) return NextResponse.json({ error: 'Nome e CPF obrigatórios' }, { status: 400 });

  const signatories = readSignatories();
  const newSig = {
    id: `sig_${crypto.randomBytes(6).toString('hex')}`,
    name,
    cpf,
    company: company || '',
    cnpj: cnpj || '',
    isDefault: false,
  };
  writeSignatories([...signatories, newSig]);
  return NextResponse.json(newSig);
}

export async function DELETE(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await req.json();
  if (!id || id === 'sig_default') {
    return NextResponse.json({ error: 'Não é possível excluir o signatário padrão' }, { status: 400 });
  }
  const signatories = readSignatories();
  writeSignatories(signatories.filter((s: any) => s.id !== id));
  return NextResponse.json({ ok: true });
}
