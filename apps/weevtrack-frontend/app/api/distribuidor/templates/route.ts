import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'dist_contract_templates.json');
const ROLES_FILE = path.join(process.cwd(), 'data', 'user_roles.json');
const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

function readTemplates(): Record<string, string> {
  try {
    if (!fs.existsSync(TEMPLATES_FILE)) return {};
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
  } catch { return {}; }
}

function writeTemplates(data: Record<string, string>) {
  const dir = path.dirname(TEMPLATES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2));
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

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const templates = readTemplates();
  const text = templates[String(ctx.user.id)] || '';
  return NextResponse.json({ text });
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ctx = await getCallerAndRole(session);
  if (!ctx) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  if (ctx.role !== 'distribuidor' && ctx.role !== 'distribuidor_geral') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { text } = await req.json();
  if (typeof text !== 'string') {
    return NextResponse.json({ error: 'text é obrigatório' }, { status: 400 });
  }

  const templates = readTemplates();
  templates[String(ctx.user.id)] = text;
  writeTemplates(templates);

  return NextResponse.json({ ok: true });
}
