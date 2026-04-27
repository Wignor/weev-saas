import { NextResponse } from 'next/server';
import { traccarLogin } from '@/lib/traccar';
import fs from 'fs';
import path from 'path';

const ROLES_FILE = path.join(process.cwd(), 'data', 'user_roles.json');

function readRoles(): Record<string, string> {
  try {
    if (!fs.existsSync(ROLES_FILE)) return {};
    return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8'));
  } catch { return {}; }
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const { user, sessionId } = await traccarLogin(email, password);
    const roles = readRoles();
    const role = user.administrator ? 'admin' : (roles[String(user.id)] || 'usuario');

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      administrator: user.administrator,
      role,
    };

    const response = NextResponse.json(payload);

    response.cookies.set('wt_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('wt_user', JSON.stringify(payload), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao fazer login' },
      { status: 401 }
    );
  }
}
