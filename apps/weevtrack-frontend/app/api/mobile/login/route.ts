import { NextResponse } from 'next/server';
import { traccarLogin } from '@/lib/traccar';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }
    const { user, sessionId } = await traccarLogin(email, password);
    return NextResponse.json({ sessionId, user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao fazer login' },
      { status: 401 }
    );
  }
}
