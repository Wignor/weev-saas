import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import {
  readLicenses, writeLicenses, createOrRenewLicense,
  daysLeft, licenseStatus,
  getCredits, useCredit,
} from '@/lib/licenses';
import { readDistClients } from '../clients/route';

const TRACCAR_URL   = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE    = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

async function getCallerAndRole(session: string) {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  const roles = readRoles();
  const role = user.administrator ? 'admin' : (roles[String(user.id)] || 'usuario');
  return { user, role };
}

/* GET — créditos disponíveis + status de licenças dos clientes do distribuidor */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const distId = String(ctx.user.id);
  const credits = getCredits(distId);
  const clientIds = (readDistClients()[distId] || []).map(String);
  const licenses = readLicenses();

  const deviceLicenses: Record<string, { expiresAt: string; daysLeft: number; status: string }> = {};
  for (const [deviceId, lic] of Object.entries(licenses)) {
    if (clientIds.includes(lic.userId)) {
      deviceLicenses[deviceId] = {
        expiresAt: lic.expiresAt,
        daysLeft: daysLeft(lic.expiresAt),
        status: licenseStatus(lic.expiresAt),
      };
    }
  }

  return NextResponse.json({ credits, licenses: deviceLicenses });
}

/* POST — distribuidor ativa/renova licença de 1 mês para um dispositivo usando 1 crédito */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { deviceId, clientId } = await req.json();
  if (!deviceId || !clientId) {
    return NextResponse.json({ error: 'deviceId e clientId são obrigatórios' }, { status: 400 });
  }

  const distId = String(ctx.user.id);
  const distData = readDistClients();
  if (!(distData[distId] || []).includes(Number(clientId))) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  const consumed = useCredit(distId);
  if (!consumed) {
    return NextResponse.json({ error: 'Sem créditos disponíveis. Solicite mais créditos ao administrador.' }, { status: 402 });
  }

  const licenses = readLicenses();
  const key = String(deviceId);
  licenses[key] = createOrRenewLicense(String(clientId), licenses[key]);
  writeLicenses(licenses);

  return NextResponse.json({
    success: true,
    credits: getCredits(distId),
    expiresAt: licenses[key].expiresAt,
    daysLeft: daysLeft(licenses[key].expiresAt),
    status: licenseStatus(licenses[key].expiresAt),
  });
}
