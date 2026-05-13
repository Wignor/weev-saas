import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { TraccarDevice } from '@/lib/traccar';
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

async function getDistClientDeviceIds(distUserId: string): Promise<Set<number>> {
  const clientIds = readDistClients()[distUserId] || [];
  if (clientIds.length === 0) return new Set();

  const adminSession = await getAdminSessionId();
  const ids = new Set<number>();
  await Promise.all(
    clientIds.map(async (clientId: number) => {
      try {
        const r = await fetch(`${TRACCAR_URL}/api/devices?userId=${clientId}`, {
          headers: adminHeaders(adminSession), cache: 'no-store',
        });
        if (!r.ok) return;
        const devs: { id: number }[] = await r.json();
        for (const d of devs) ids.add(d.id);
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
  let role = 'usuario';
  let traccarUserId = '';
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) {
      const u = JSON.parse(decodeURIComponent(raw));
      isAdmin = !!u.administrator;
      role = u.role || 'usuario';
      traccarUserId = String(u.id || '');
    }
  } catch { /* silencioso */ }

  // For distributors: resolve role from server-side file (more reliable than cookie)
  if (!isAdmin && traccarUserId) {
    const roles = readRoles();
    role = roles[traccarUserId] || role;
  }

  const isDistributor = role === 'distribuidor' || role === 'distribuidor_geral';

  const asUser = req.nextUrl.searchParams.get('asUser');
  const all = req.nextUrl.searchParams.get('all') === 'true';

  try {
    // Distribuidor viewing one of their clients — use admin session for Traccar
    if (asUser && isDistributor && traccarUserId) {
      const clientIds = readDistClients()[traccarUserId] || [];
      if (!clientIds.includes(Number(asUser))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const adminSess = await getAdminSessionId();
      const r = await fetch(`${TRACCAR_URL}/api/devices?userId=${asUser}`, {
        headers: adminHeaders(adminSess), cache: 'no-store',
      });
      if (!r.ok) return NextResponse.json({ error: 'Erro ao buscar dispositivos' }, { status: 500 });
      return NextResponse.json(await r.json());
    }

    const url = asUser
      ? `${TRACCAR_URL}/api/devices?userId=${asUser}`
      : `${TRACCAR_URL}/api/devices`;

    const res = await fetch(url, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (res.status === 401) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    if (!res.ok) return NextResponse.json({ error: `Traccar ${res.status}` }, { status: res.status });
    const devices: TraccarDevice[] = await res.json();

    if (isAdmin && !asUser && !all) {
      const assignedIds = await getAssignedDeviceIds(session);
      return NextResponse.json(
        assignedIds.size > 0 ? devices.filter((d) => !assignedIds.has(d.id)) : devices
      );
    }

    if (isDistributor && !asUser && !all && traccarUserId) {
      const clientDeviceIds = await getDistClientDeviceIds(traccarUserId);
      return NextResponse.json(
        clientDeviceIds.size > 0 ? devices.filter((d) => !clientDeviceIds.has(d.id)) : devices
      );
    }

    return NextResponse.json(devices);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar dispositivos' },
      { status: 500 }
    );
  }
}
