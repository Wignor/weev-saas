import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readRoles, saveRole } from '@/lib/userRoles';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

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

  const { name, email: realEmail, password, phone, cpfCnpj, role } = await req.json();
  if (!name || !cpfCnpj || !password) {
    return NextResponse.json({ error: 'Nome, CPF/CNPJ e senha são obrigatórios' }, { status: 400 });
  }

  // Email interno do Traccar baseado no CPF/CNPJ (sem formatação)
  const cleanCpf = cpfCnpj.replace(/[\.\-\/\s]/g, '').trim();
  const traccarEmail = `${cleanCpf}@weevtrack.com`;

  const res = await fetch(`${TRACCAR_URL}/api/users`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email: traccarEmail,
      password,
      administrator: false,
      phone: phone || '',
      attributes: { cpfCnpj: cpfCnpj || '', realEmail: realEmail || '' },
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
