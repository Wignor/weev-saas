import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ROLES_FILE  = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch { return {}; }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session   = cookieStore.get('wt_session')?.value;
  const wtUserRaw = cookieStore.get('wt_user')?.value;

  if (!session || !wtUserRaw) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let adminUser: { id: number; name: string; email: string; administrator: boolean; role: string };
  try {
    adminUser = JSON.parse(decodeURIComponent(wtUserRaw));
    if (!adminUser.administrator) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });

  try {
    const userRes = await fetch(`${TRACCAR_URL}/api/users/${userId}`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });

    if (!userRes.ok) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    const clientUser = await userRes.json();

    const roles = readRoles();
    const role  = roles[String(clientUser.id)] || 'usuario';

    const clientPayload = {
      id: clientUser.id,
      name: clientUser.name,
      email: clientUser.email,
      administrator: false,
      role,
      impersonating: true,
    };

    const secure = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true, user: clientPayload });

    // Keep original admin for exit
    response.cookies.set('wt_admin_user', JSON.stringify(adminUser), {
      httpOnly: false, secure, sameSite: 'lax', maxAge: 60 * 60 * 24, path: '/',
    });
    // Replace wt_user with client — wt_session stays as admin JSESSIONID
    response.cookies.set('wt_user', JSON.stringify(clientPayload), {
      httpOnly: false, secure, sameSite: 'lax', maxAge: 60 * 60 * 24, path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 });
  }
}
