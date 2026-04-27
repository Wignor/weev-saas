import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try {
    if (!fs.existsSync(ROLES_FILE)) return {};
    return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8'));
  } catch { return {}; }
}

export function saveRole(userId: string | number, role: string) {
  const roles = readRoles();
  roles[String(userId)] = role;
  const dir = path.dirname(ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

export function deleteRole(userId: string | number) {
  const roles = readRoles();
  delete roles[String(userId)];
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const res = await fetch(`${TRACCAR_URL}/api/users`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });

  if (res.status === 403) return NextResponse.json({ error: 'Sem permissão de administrador' }, { status: 403 });
  if (!res.ok) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });

  const users = await res.json();
  const roles = readRoles();
  const merged = users.map((u: any) => ({ ...u, role: roles[String(u.id)] || 'usuario' }));
  return NextResponse.json(merged);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { name, email, password, phone, cpfCnpj, role } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }

  const res = await fetch(`${TRACCAR_URL}/api/users`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      password,
      administrator: false,
      phone: phone || '',
      attributes: { cpfCnpj: cpfCnpj || '' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || 'Erro ao criar usuário' }, { status: res.status });
  }

  const created = await res.json();
  if (role && role !== 'usuario') saveRole(created.id, role);
  return NextResponse.json({ ...created, role: role || 'usuario' });
}
