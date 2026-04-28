import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { readDistClients } from '@/lib/distributorClients';

const TRACCAR_URL   = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE    = path.join(process.cwd(), 'data', 'user_roles.json');
const SESSION_CACHE = path.join(process.cwd(), 'data', 'admin_session.cache');

function adminSession(): string {
  try { return fs.readFileSync(SESSION_CACHE, 'utf-8').trim(); } catch { return ''; }
}

function adminHdrs() {
  return { Cookie: `JSESSIONID=${adminSession()}`, 'Content-Type': 'application/json' };
}

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

function isDist(role: string) {
  return role === 'distribuidor' || role === 'distribuidor_geral';
}

function ownsClient(distId: string, clientId: number): boolean {
  return (readDistClients()[distId] || []).includes(clientId);
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx || !isDist(ctx.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  if (!deviceId) return NextResponse.json({ error: 'deviceId obrigatório' }, { status: 400 });

  const r = await fetch(`${TRACCAR_URL}/api/geofences?deviceId=${deviceId}`, {
    headers: adminHdrs(), cache: 'no-store',
  });
  if (!r.ok) return NextResponse.json({ error: 'Erro ao buscar geocercas' }, { status: 500 });
  return NextResponse.json(await r.json());
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx || !isDist(ctx.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { name, lat, lon, radius, deviceId, clientId } = await req.json();
  if (!name || lat == null || lon == null || !radius || !deviceId || !clientId) {
    return NextResponse.json({ error: 'Campos incompletos' }, { status: 400 });
  }
  if (!ownsClient(String(ctx.user.id), Number(clientId))) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  const createR = await fetch(`${TRACCAR_URL}/api/geofences`, {
    method: 'POST',
    headers: adminHdrs(),
    body: JSON.stringify({ name, area: `CIRCLE (${lat} ${lon}, ${radius})`, description: '' }),
  });
  if (!createR.ok) return NextResponse.json({ error: 'Erro ao criar geocerca' }, { status: 500 });
  const geo = await createR.json();

  const permR = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: adminHdrs(),
    body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: geo.id }),
  });
  if (!permR.ok) {
    await fetch(`${TRACCAR_URL}/api/geofences/${geo.id}`, { method: 'DELETE', headers: adminHdrs() });
    return NextResponse.json({ error: 'Erro ao vincular geocerca' }, { status: 500 });
  }
  return NextResponse.json({ success: true, geofence: geo });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx || !isDist(ctx.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { geofenceId, deviceId, clientId } = await req.json();
  if (!geofenceId) return NextResponse.json({ error: 'geofenceId obrigatório' }, { status: 400 });

  if (clientId && !ownsClient(String(ctx.user.id), Number(clientId))) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  if (deviceId) {
    await fetch(`${TRACCAR_URL}/api/permissions`, {
      method: 'DELETE',
      headers: adminHdrs(),
      body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: Number(geofenceId) }),
    });
  }

  const r = await fetch(`${TRACCAR_URL}/api/geofences/${geofenceId}`, {
    method: 'DELETE', headers: adminHdrs(),
  });
  if (!r.ok) return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  return NextResponse.json({ success: true });
}
