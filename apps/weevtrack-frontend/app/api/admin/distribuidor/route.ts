import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDistClients, writeDistClients } from '@/lib/distributorClients';

/* GET — retorna mapa { distributorId: [clientId, ...] } para o admin */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Verificar admin via cookie wt_user
  const userCookie = cookieStore.get('wt_user')?.value;
  try {
    const u = JSON.parse(decodeURIComponent(userCookie || '{}'));
    if (!u.administrator) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  return NextResponse.json(readDistClients());
}

/* POST — admin atribui cliente a um distribuidor */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const userCookie = cookieStore.get('wt_user')?.value;
  try {
    const u = JSON.parse(decodeURIComponent(userCookie || '{}'));
    if (!u.administrator) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { distributorId, clientId } = await req.json();
  if (!distributorId || !clientId) {
    return NextResponse.json({ error: 'distributorId e clientId são obrigatórios' }, { status: 400 });
  }

  const data = readDistClients();

  // Remove de qualquer distribuidor atual
  for (const key of Object.keys(data)) {
    data[key] = data[key].filter(id => id !== Number(clientId));
  }

  // Adiciona ao distribuidor escolhido
  const distKey = String(distributorId);
  if (!data[distKey]) data[distKey] = [];
  data[distKey].push(Number(clientId));

  writeDistClients(data);
  return NextResponse.json({ ok: true });
}

/* DELETE — admin remove cliente de um distribuidor */
export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const userCookie = cookieStore.get('wt_user')?.value;
  try {
    const u = JSON.parse(decodeURIComponent(userCookie || '{}'));
    if (!u.administrator) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório' }, { status: 400 });

  const data = readDistClients();
  for (const key of Object.keys(data)) {
    data[key] = data[key].filter(id => id !== Number(clientId));
  }
  writeDistClients(data);
  return NextResponse.json({ ok: true });
}
