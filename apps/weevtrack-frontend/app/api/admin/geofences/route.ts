import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL   = process.env.TRACCAR_URL || 'http://localhost:8082';
const SESSION_CACHE = path.join(process.cwd(), 'data', 'admin_session.cache');

function adminSession(): string {
  try { return fs.readFileSync(SESSION_CACHE, 'utf-8').trim(); } catch { return ''; }
}

function adminHdrs() {
  return { Cookie: `JSESSIONID=${adminSession()}`, 'Content-Type': 'application/json' };
}

async function isAdmin(session: string): Promise<boolean> {
  const r = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  if (!r.ok) return false;
  return (await r.json()).administrator === true;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session || !await isAdmin(session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const url = deviceId
    ? `${TRACCAR_URL}/api/geofences?deviceId=${deviceId}`
    : `${TRACCAR_URL}/api/geofences`;

  const r = await fetch(url, { headers: adminHdrs(), cache: 'no-store' });
  if (!r.ok) return NextResponse.json({ error: 'Erro ao buscar geocercas' }, { status: 500 });
  return NextResponse.json(await r.json());
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session || !await isAdmin(session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { name, lat, lon, radius, deviceId } = await req.json();
  if (!name || lat == null || lon == null || !radius || !deviceId) {
    return NextResponse.json({ error: 'name, lat, lon, radius, deviceId são obrigatórios' }, { status: 400 });
  }

  // Create geofence in Traccar
  const createR = await fetch(`${TRACCAR_URL}/api/geofences`, {
    method: 'POST',
    headers: adminHdrs(),
    body: JSON.stringify({ name, area: `CIRCLE (${lat} ${lon}, ${radius})`, description: '' }),
  });
  if (!createR.ok) return NextResponse.json({ error: 'Erro ao criar geocerca no Traccar' }, { status: 500 });
  const geo = await createR.json();

  // Link geofence to device
  const permR = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: adminHdrs(),
    body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: geo.id }),
  });
  if (!permR.ok) {
    await fetch(`${TRACCAR_URL}/api/geofences/${geo.id}`, { method: 'DELETE', headers: adminHdrs() });
    return NextResponse.json({ error: 'Erro ao vincular geocerca ao dispositivo' }, { status: 500 });
  }

  return NextResponse.json({ success: true, geofence: geo });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session || !await isAdmin(session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { geofenceId, deviceId } = await req.json();
  if (!geofenceId) return NextResponse.json({ error: 'geofenceId obrigatório' }, { status: 400 });

  // Unlink from device first
  if (deviceId) {
    await fetch(`${TRACCAR_URL}/api/permissions`, {
      method: 'DELETE',
      headers: adminHdrs(),
      body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: Number(geofenceId) }),
    });
  }

  // Delete the geofence (cascades any remaining links)
  const r = await fetch(`${TRACCAR_URL}/api/geofences/${geofenceId}`, {
    method: 'DELETE',
    headers: adminHdrs(),
  });
  if (!r.ok) return NextResponse.json({ error: 'Erro ao excluir geocerca' }, { status: 500 });
  return NextResponse.json({ success: true });
}
