import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL   = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE    = path.join(process.cwd(), 'data', 'user_roles.json');
const DIST_FILE     = path.join(process.cwd(), 'data', 'distributor_clients.json');
const SESSION_CACHE = path.join(process.cwd(), 'data', 'admin_session.cache');

function getAdminSession(): string {
  try { return fs.readFileSync(SESSION_CACHE, 'utf-8').trim(); } catch { return ''; }
}

function adminHeaders() {
  return {
    Cookie: `JSESSIONID=${getAdminSession()}`,
    'Content-Type': 'application/json',
  };
}

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

export function readDistClients(): Record<string, number[]> {
  try {
    if (!fs.existsSync(DIST_FILE)) return {};
    return JSON.parse(fs.readFileSync(DIST_FILE, 'utf-8'));
  } catch { return {}; }
}

export function writeDistClients(data: Record<string, number[]>) {
  const dir = path.dirname(DIST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DIST_FILE, JSON.stringify(data, null, 2));
}

async function getCallerAndRole(session: string) {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  const roles = readRoles();
  const role = user.administrator ? 'admin' : (roles[String(user.id)] || 'usuario');
  return { user, role };
}

/* GET — distribuidor lista seus próprios clientes */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Acesso restrito a distribuidores' }, { status: 403 });
  }

  const distId = String(ctx.user.id);
  const distData = readDistClients();
  const clientIds = distData[distId] || [];
  if (clientIds.length === 0) return NextResponse.json([]);

  const usersRes = await fetch(`${TRACCAR_URL}/api/users`, {
    headers: adminHeaders(), cache: 'no-store',
  });
  if (!usersRes.ok) return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });

  const allUsers: any[] = await usersRes.json();
  const roles = readRoles();
  const myClients = allUsers
    .filter(u => clientIds.includes(u.id) && !u.administrator)
    .map(u => ({ ...u, role: roles[String(u.id)] || 'usuario' }));

  return NextResponse.json(myClients);
}

/* POST — distribuidor cria novo cliente (vinculado automaticamente a ele) */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Acesso restrito a distribuidores' }, { status: 403 });
  }

  const { name, email, password, phone } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }

  const createRes = await fetch(`${TRACCAR_URL}/api/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name, email, password, phone: phone || '', administrator: false }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return NextResponse.json({ error: (err as any).message || 'Erro ao criar usuário' }, { status: 400 });
  }

  const created = await createRes.json();

  const distData = readDistClients();
  const distId = String(ctx.user.id);
  if (!distData[distId]) distData[distId] = [];
  distData[distId].push(created.id);
  writeDistClients(distData);

  return NextResponse.json(created);
}
