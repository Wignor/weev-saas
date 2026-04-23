import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { traccarGet, TraccarPosition } from '@/lib/traccar';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const positions = await traccarGet<TraccarPosition[]>('/api/positions', session);
    return NextResponse.json(positions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}
