import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readLicenses, writeLicenses, createOrRenewLicense } from '@/lib/licenses';
import { appendClientRow, removeClientRowByImei } from '@/lib/sheets';

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

  // Auto-create 31-day license
  const licenses = readLicenses();
  const key = String(deviceId);
  if (!licenses[key]) {
    licenses[key] = createOrRenewLicense(id);
    writeLicenses(licenses);
  }

  // Write to Google Sheets asynchronously (don't block response)
  try {
    const [userRes, deviceRes] = await Promise.all([
      fetch(`${TRACCAR_URL}/api/users/${id}`, { headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store' }),
      fetch(`${TRACCAR_URL}/api/devices/${deviceId}`, { headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store' }),
    ]);
    if (userRes.ok && deviceRes.ok) {
      const [user, device] = await Promise.all([userRes.json(), deviceRes.json()]);
      appendClientRow({
        nome: user.name || '',
        email: user.email || '',
        cpfCnpj: user.attributes?.cpfCnpj || '',
        telefone: user.phone || '',
        veiculo: device.name || '',
        imei: device.uniqueId || '',
        modelo: device.model || '',
        iccid: device.attributes?.iccid || '',
        chip: device.contact || '',
      });
    }
  } catch { /* silencioso — planilha não bloqueia atribuição */ }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const { deviceId } = await req.json();

  // Fetch device before removing (need IMEI for sheet cleanup)
  let deviceImei = '';
  try {
    const devRes = await fetch(`${TRACCAR_URL}/api/devices/${deviceId}`, {
      headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
    });
    if (devRes.ok) {
      const dev = await devRes.json();
      deviceImei = dev.uniqueId || '';
    }
  } catch { /**/ }

  const res = await fetch(`${TRACCAR_URL}/api/permissions`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(id), deviceId: Number(deviceId) }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao remover dispositivo' }, { status: res.status });

  // Remove corresponding row from Google Sheets
  if (deviceImei) removeClientRowByImei(deviceImei).catch(() => {});

  return NextResponse.json({ success: true });
}
