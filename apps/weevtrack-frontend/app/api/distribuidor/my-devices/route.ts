import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import {
  readLicenses, writeLicenses, createOrRenewLicense,
  daysLeft, licenseStatus, getCredits, useCredit,
} from '@/lib/licenses';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE  = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

async function getCtx(session: string) {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  const role = user.administrator ? 'admin' : (readRoles()[String(user.id)] || 'usuario');
  return { user, role };
}

function isDistributor(role: string) {
  return role === 'distribuidor' || role === 'distribuidor_geral';
}

/* GET — dispositivos atribuídos diretamente ao distribuidor + status de licença */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCtx(session);
  if (!ctx || !isDistributor(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const devRes = await fetch(`${TRACCAR_URL}/api/devices?userId=${ctx.user.id}`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  const devices = devRes.ok ? await devRes.json() : [];
  const licenses = readLicenses();

  const result = (Array.isArray(devices) ? devices : []).map((d: {
    id: number; name: string; uniqueId: string; status: string; lastUpdate: string;
  }) => {
    const lic = licenses[String(d.id)];
    return {
      id: d.id, name: d.name, uniqueId: d.uniqueId,
      status: d.status, lastUpdate: d.lastUpdate,
      license: lic ? {
        expiresAt: lic.expiresAt,
        daysLeft: daysLeft(lic.expiresAt),
        status: licenseStatus(lic.expiresAt),
      } : null,
    };
  });

  return NextResponse.json({ devices: result, credits: getCredits(String(ctx.user.id)) });
}

/* POST — ativar/renovar +31 dias para dispositivo próprio do distribuidor */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCtx(session);
  if (!ctx || !isDistributor(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { deviceId } = await req.json();
  if (!deviceId) return NextResponse.json({ error: 'deviceId obrigatório' }, { status: 400 });

  const distId = String(ctx.user.id);

  const devRes = await fetch(`${TRACCAR_URL}/api/devices?userId=${ctx.user.id}`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  const devices = devRes.ok ? await devRes.json() : [];
  const owns = (Array.isArray(devices) ? devices : []).some((d: { id: number }) => d.id === Number(deviceId));
  if (!owns) return NextResponse.json({ error: 'Dispositivo não pertence a você' }, { status: 403 });

  if (!useCredit(distId)) {
    return NextResponse.json({ error: 'Sem créditos disponíveis. Solicite créditos ao administrador.' }, { status: 402 });
  }

  const licenses = readLicenses();
  const key = String(deviceId);
  licenses[key] = createOrRenewLicense(distId, licenses[key]);
  writeLicenses(licenses);

  return NextResponse.json({
    success: true,
    credits: getCredits(distId),
    expiresAt: licenses[key].expiresAt,
    daysLeft: daysLeft(licenses[key].expiresAt),
    status: licenseStatus(licenses[key].expiresAt),
  });
}
