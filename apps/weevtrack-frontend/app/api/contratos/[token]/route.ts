import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import type { Contract } from '@/lib/contracts';

const DATA_DIR = path.join(process.cwd(), 'data', 'contracts');

function contractPath(token: string) {
  return path.join(DATA_DIR, `${token}.json`);
}

function readContract(token: string): Contract | null {
  try {
    const p = contractPath(token);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;
  const contract = readContract(token);
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });

  // ?full=1 retorna dados completos (assinatura + selfie) apenas para admins autenticados
  if (req.nextUrl.searchParams.get('full') === '1') {
    const cookieStore = await cookies();
    const session = cookieStore.get('wt_session')?.value;
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json({ ...contract, signed: contract.status === 'signed' });
  }

  const { clientSignature, selfiePhoto, ...safe } = contract;
  return NextResponse.json({ ...safe, signed: contract.status === 'signed' });
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;
  const contract = readContract(token);
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
  if (contract.status === 'signed') return NextResponse.json({ error: 'Contrato já assinado' }, { status: 409 });

  const body = await req.json();
  const { signature, selfie } = body;

  if (!signature) return NextResponse.json({ error: 'Assinatura obrigatória' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;

  const updated: Contract = {
    ...contract,
    clientSignature: signature,
    selfiePhoto: selfie || null,
    signedAt: new Date().toISOString(),
    status: 'signed',
    ipAddress: ip,
  };

  fs.writeFileSync(contractPath(token), JSON.stringify(updated, null, 2));
  return NextResponse.json({ ok: true, signedAt: updated.signedAt });
}
