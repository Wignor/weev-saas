import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  const res = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: res.status });
  return NextResponse.json({ success: true });
}
