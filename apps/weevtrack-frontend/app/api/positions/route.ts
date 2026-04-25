import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TraccarPosition } from '@/lib/traccar';

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

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let isAdmin = false;
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) isAdmin = !!JSON.parse(decodeURIComponent(raw)).administrator;
  } catch { /* silencioso */ }

  const asUser = req.nextUrl.searchParams.get('asUser');
  const url = asUser
    ? `${TRACCAR_URL}/api/positions?userId=${asUser}`
    : `${TRACCAR_URL}/api/positions`;

  try {
    const res = await fetch(url, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `Traccar ${res.status}` }, { status: res.status });
    const positions: TraccarPosition[] = await res.json();

    if (isAdmin && !asUser) {
      const assignedIds = await getAssignedDeviceIds(session);
      return NextResponse.json(
        assignedIds.size > 0 ? positions.filter((p) => !assignedIds.has(p.deviceId)) : positions
      );
    }

    return NextResponse.json(positions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}
