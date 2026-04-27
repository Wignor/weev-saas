import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get('wt_session')?.value;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const deviceId = req.nextUrl.searchParams.get('deviceId');
  const url = deviceId
    ? `${TRACCAR_URL}/api/geofences?deviceId=${deviceId}`
    : `${TRACCAR_URL}/api/geofences`;

  const res = await fetch(url, { headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store' });
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { deviceId, name, lat, lon, radius } = await req.json();
  if (!deviceId || lat === undefined || lon === undefined || !radius) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const area = `CIRCLE (${lat} ${lon}, ${radius})`;
  const createRes = await fetch(`${TRACCAR_URL}/api/geofences`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'Cerca Virtual', area, attributes: {} }),
  });

  if (!createRes.ok) return NextResponse.json({ error: 'Erro ao criar cerca' }, { status: createRes.status });
  const geofence = await createRes.json();

  await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: geofence.id }),
  });

  return NextResponse.json(geofence);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { geofenceId, deviceId } = await req.json();

  if (deviceId) {
    await fetch(`${TRACCAR_URL}/api/permissions`, {
      method: 'DELETE',
      headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: Number(deviceId), geofenceId: Number(geofenceId) }),
    });
  }

  const res = await fetch(`${TRACCAR_URL}/api/geofences/${geofenceId}`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao excluir cerca' }, { status: res.status });
  return NextResponse.json({ ok: true });
}
