import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { traccarGet, TraccarDevice } from '@/lib/traccar';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const devices = await traccarGet<TraccarDevice[]>('/api/devices', session);
    return NextResponse.json(devices);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar dispositivos' },
      { status: 500 }
    );
  }
}
