import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get('wt_session')?.value;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  const res = await fetch(`${TRACCAR_URL}/api/devices?userId=${id}`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });

  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const { deviceId } = await req.json();

  const res = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'POST',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(id), deviceId: Number(deviceId) }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao atribuir dispositivo' }, { status: res.status });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const { deviceId } = await req.json();

  const res = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(id), deviceId: Number(deviceId) }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao remover dispositivo' }, { status: res.status });
  return NextResponse.json({ success: true });
}
