import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { TraccarPosition } from '@/lib/traccar';
import { readLicenses } from '@/lib/licenses';
import { readDistClients } from '@/lib/distributorClients';
import { getAdminSessionId, adminHeaders } from '@/lib/adminSession';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE  = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

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
  let traccarUserId = '';
  let role = 'usuario';
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) {
      const u = JSON.parse(decodeURIComponent(raw));
      isAdmin = !!u.administrator;
      traccarUserId = String(u.id || '');
      role = u.role || 'usuario';
    }
  } catch { /* silencioso */ }

  if (!isAdmin && traccarUserId) {
    const roles = readRoles();
    role = roles[traccarUserId] || role;
  }
  const isDistributor = role === 'distribuidor' || role === 'distribuidor_geral';

  const asUser = req.nextUrl.searchParams.get('asUser');

  try {
    // Distribuidor viewing one of their clients — use admin session for Traccar
    if (asUser && isDistributor && traccarUserId) {
      const clientIds = readDistClients()[traccarUserId] || [];
      if (!clientIds.includes(Number(asUser))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const adminSess = await getAdminSessionId();
      const r = await fetch(`${TRACCAR_URL}/api/positions?userId=${asUser}`, {
        headers: adminHeaders(adminSess), cache: 'no-store',
      });
      if (!r.ok) return NextResponse.json({ error: 'Erro ao buscar posições' }, { status: 500 });
      return NextResponse.json(await r.json());
    }

    const url = asUser
      ? `${TRACCAR_URL}/api/positions?userId=${asUser}`
      : `${TRACCAR_URL}/api/positions`;

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

    // Filter expired licenses for non-admin clients
    const licenses = readLicenses();
    const now = Date.now();
    return NextResponse.json(positions.filter(p => {
      const lic = licenses[String(p.deviceId)];
      if (!lic) return true;
      return new Date(lic.expiresAt).getTime() > now;
    }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}
