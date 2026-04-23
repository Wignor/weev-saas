import { NextResponse } from 'next/server';
import { traccarGet, TraccarPosition } from '@/lib/traccar';

function getSession(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!deviceId || !from || !to) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: deviceId, from, to' }, { status: 400 });
  }

  try {
    const path = `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const positions = await traccarGet<TraccarPosition[]>(path, session);
    return NextResponse.json(positions);
  } catch (err) {
    const status = err instanceof Error && err.message === 'Sessão expirada' ? 401 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status });
  }
}
