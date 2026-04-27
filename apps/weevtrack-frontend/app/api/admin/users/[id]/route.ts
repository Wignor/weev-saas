import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveRole, deleteRole } from '../route';

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
  deleteRole(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const { role } = await req.json();
  if (!role) return NextResponse.json({ error: 'Função obrigatória' }, { status: 400 });

  saveRole(id, role);
  return NextResponse.json({ ok: true, id, role });
}
