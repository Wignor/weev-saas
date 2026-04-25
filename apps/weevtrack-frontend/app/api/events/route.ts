import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

async function getAssignedDeviceIds(session: string): Promise<Set<number>> {
  const usersRes = await fetch(`${TRACCAR_URL}/api/users`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });
  if (!usersRes.ok) return new Set();
  const users: { id: number; administrator: boolean }[] = await usersRes.json();
  const clients = users.filter((u) => !u.administrator);

  const ids = new Set<number>();
  await Promise.all(
    clients.map(async (client) => {
      try {
        const devRes = await fetch(`${TRACCAR_URL}/api/devices?userId=${client.id}`, {
          headers: { Cookie: `JSESSIONID=${session}` },
          cache: 'no-store',
        });
        if (!devRes.ok) return;
        const devices: { id: number }[] = await devRes.json();
        for (const d of devices) ids.add(d.id);
      } catch { /* silencioso */ }
    })
  );
  return ids;
}

async function getDeviceIdsForUser(session: string, userId: number): Promise<Set<number>> {
  const res = await fetch(`${TRACCAR_URL}/api/devices?userId=${userId}`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Set();
  const devices: { id: number }[] = await res.json();
  return new Set(devices.map((d) => d.id));
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let user: { id: number; administrator: boolean } | null = null;
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) user = JSON.parse(decodeURIComponent(raw));
  } catch { /* silencioso */ }
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId') || '';
  const asUser = searchParams.get('asUser');

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
    ...(deviceId ? { deviceId } : {}),
  });

  try {
    const res = await fetch(`${TRACCAR_URL}/api/reports/events?${params}`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    const events: { deviceId: number }[] = await res.json();

    if (user.administrator && !asUser) {
      // Admin vendo painel próprio: exclui dispositivos atribuídos a clientes
      const assignedIds = await getAssignedDeviceIds(session);
      return NextResponse.json(
        assignedIds.size > 0 ? events.filter((e) => !assignedIds.has(e.deviceId)) : events
      );
    }

    // Cliente ou admin visualizando como cliente (?asUser=ID)
    const targetId = asUser ? parseInt(asUser, 10) : user.id;
    const allowed = await getDeviceIdsForUser(session, targetId);
    return NextResponse.json(events.filter((e) => allowed.has(e.deviceId)));
  } catch {
    return NextResponse.json([]);
  }
}
