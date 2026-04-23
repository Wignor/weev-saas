import { NextResponse } from 'next/server';
import { traccarLogin } from '@/lib/traccar';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const { user, sessionId } = await traccarLogin(email, password);

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      administrator: user.administrator,
    });

    response.cookies.set('wt_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });

    response.cookies.set('wt_user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      administrator: user.administrator,
    }), {
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
