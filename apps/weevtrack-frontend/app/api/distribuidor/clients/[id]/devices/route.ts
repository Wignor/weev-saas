import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { readDistClients } from '@/lib/distributorClients';
import { getAdminSessionId, adminHeaders } from '@/lib/adminSession';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE  = path.join(process.cwd(), 'data', 'user_roles.json');

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

function isMyClient(distId: string, clientId: number) {
  const data = readDistClients();
  return (data[distId] || []).includes(clientId);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const clientId = Number(params.id);
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!isMyClient(String(ctx.user.id), clientId)) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  const adminSession = await getAdminSessionId();
  const res = await fetch(`${TRACCAR_URL}/api/devices?userId=${clientId}`, {
    headers: adminHeaders(adminSession), cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ error: 'Erro ao buscar dispositivos' }, { status: 500 });
  return NextResponse.json(await res.json());
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const clientId = Number(params.id);
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!isMyClient(String(ctx.user.id), clientId)) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  const { deviceId } = await req.json();
  const adminSession = await getAdminSessionId();
  const res = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: adminHeaders(adminSession),
    body: JSON.stringify({ userId: clientId, deviceId }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao atribuir dispositivo' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const clientId = Number(params.id);
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!isMyClient(String(ctx.user.id), clientId)) {
    return NextResponse.json({ error: 'Cliente não pertence a você' }, { status: 403 });
  }

  const { deviceId } = await req.json();
  const adminSession = await getAdminSessionId();
  const res = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'DELETE',
    headers: adminHeaders(adminSession),
    body: JSON.stringify({ userId: clientId, deviceId }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao remover dispositivo' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
