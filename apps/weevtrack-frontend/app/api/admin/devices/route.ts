import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get('wt_session')?.value;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { name, uniqueId, modelo, iccid, chip } = await req.json();
  if (!name || !uniqueId) return NextResponse.json({ error: 'Nome e IMEI obrigatórios' }, { status: 400 });

  const res = await fetch(`${TRACCAR_URL}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
    body: JSON.stringify({
      name,
      uniqueId,
      model: modelo || '',
      contact: chip || '',
      attributes: { iccid: iccid || '' },
    }),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.message || 'Erro ao cadastrar dispositivo' }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { deviceId } = await req.json();
  const res = await fetch(`${TRACCAR_URL}/api/devices/${deviceId}`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao excluir dispositivo' }, { status: res.status });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { deviceId, name } = await req.json();
  if (!deviceId || !name) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

  const getRes = await fetch(`${TRACCAR_URL}/api/devices/${deviceId}`, {
    headers: { Cookie: `JSESSIONID=${session}` },
    cache: 'no-store',
  });
  if (!getRes.ok) return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
  const device = await getRes.json();

  const putRes = await fetch(`${TRACCAR_URL}/api/devices/${deviceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
    body: JSON.stringify({ ...device, name }),
  });

  if (!putRes.ok) return NextResponse.json({ error: 'Erro ao renomear dispositivo' }, { status: putRes.status });
  return NextResponse.json(await putRes.json());
}
