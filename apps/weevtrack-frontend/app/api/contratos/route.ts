import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONTRACT_TEMPLATES, getContractText, type Contract } from '@/lib/contracts';

const DATA_DIR = path.join(process.cwd(), 'data', 'contracts');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get('wt_session')?.value;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  ensureDir();
  const userId = req.nextUrl.searchParams.get('userId');

  const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')) : [];
  let contracts = files.map(f => {
    try {
      const data: Contract = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
      const { contractText, clientSignature, selfiePhoto, ...summary } = data;
      return summary;
    } catch { return null; }
  }).filter(Boolean);

  if (userId) contracts = contracts.filter((c: any) => String(c.userId) === userId);
  contracts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  ensureDir();

  const body = await req.json();
  const { templateId, userId, clientName, clientCpfCnpj, clientPhone, clientEmail, vehicle, vehiclePlate, deviceImei } = body;

  if (!templateId || !userId || !clientName) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });

  const token = crypto.randomBytes(18).toString('hex');
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const contractText = getContractText(template, {
    nome: clientName,
    cpfCnpj: clientCpfCnpj || '—',
    data: date,
    veiculo: vehicle || '—',
    placa: vehiclePlate || '—',
    imei: deviceImei || '—',
  });

  const contract: Contract = {
    id: token,
    token,
    templateId,
    templateName: template.name,
    userId: Number(userId),
    clientName,
    clientCpfCnpj: clientCpfCnpj || '',
    clientPhone: clientPhone || '',
    clientEmail: clientEmail || '',
    vehicle: vehicle || '',
    vehiclePlate: vehiclePlate || '',
    deviceImei: deviceImei || '',
    installationValue: template.installationValue,
    monthlyValue: template.monthlyValue,
    createdAt: new Date().toISOString(),
    signedAt: null,
    status: 'pending',
    contractText,
    clientSignature: null,
    selfiePhoto: null,
    ipAddress: null,
  };

  fs.writeFileSync(path.join(DATA_DIR, `${token}.json`), JSON.stringify(contract, null, 2));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weevtrack.com';
  return NextResponse.json({ token, url: `${appUrl}/contrato/${token}` });
}
