import { NextResponse } from 'next/server';
import { traccarGet, TraccarDevice } from '@/lib/traccar';

function getSession(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const devices = await traccarGet<TraccarDevice[]>('/api/devices', session);
    return NextResponse.json(devices);
  } catch (err) {
    const status = err instanceof Error && err.message === 'Sessão expirada' ? 401 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status });
  }
}
