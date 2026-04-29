import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { traccarGet } from '@/lib/traccar';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!deviceId || !from || !to) return NextResponse.json({ error: 'Parâmetros obrigatórios: deviceId, from, to' }, { status: 400 });

  try {
    const data = await traccarGet(`/api/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, session);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
