import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { getAdminSessionId, adminHeaders } from '@/lib/adminSession';

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

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCtx(session);
  if (!ctx || !isDistributor(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { name, uniqueId, modelo, iccid, chip } = await req.json();
  if (!name || !uniqueId) {
    return NextResponse.json({ error: 'Nome e IMEI são obrigatórios' }, { status: 400 });
  }

  const adminSession = await getAdminSessionId();
  if (!adminSession) {
    return NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 });
  }

  // 1. Create device using admin session
  const createRes = await fetch(`${TRACCAR_URL}/api/devices`, {
    method: 'POST',
    headers: adminHeaders(adminSession),
    body: JSON.stringify({
      name,
      uniqueId,
      model: modelo || '',
      contact: chip || '',
      attributes: { iccid: iccid || '' },
    }),
  });

  const text = await createRes.text();
  let device: Record<string, unknown> = {};
  try { device = JSON.parse(text); } catch { /**/ }

  if (!createRes.ok) {
    const raw = (device.message as string) || text || '';
    const isDuplicate = raw.toLowerCase().includes('duplicate') || raw.toLowerCase().includes('uniqueid');
    const msg = isDuplicate
      ? `IMEI ${uniqueId} já está cadastrado na plataforma.`
      : raw || 'Erro ao cadastrar dispositivo';
    return NextResponse.json({ error: msg }, { status: createRes.status });
  }

  const deviceId = device.id as number;

  // 2. Link device to the distribuidor's userId in Traccar
  await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: adminHeaders(adminSession),
    body: JSON.stringify({ userId: ctx.user.id, deviceId }),
  });

  return NextResponse.json({ success: true, device });
}
