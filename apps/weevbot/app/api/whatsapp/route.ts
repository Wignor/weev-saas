import { NextResponse } from 'next/server';

const BASE_URL  = () => process.env.EVOLUTION_API_URL!;
const INSTANCE  = () => process.env.EVOLUTION_INSTANCE!;
const API_KEY   = () => process.env.EVOLUTION_API_KEY!;
const headers   = () => ({ 'Content-Type': 'application/json', apikey: API_KEY() });

export async function GET() {
  const base = BASE_URL();
  const inst = INSTANCE();
  const key  = API_KEY();
  if (!base || !inst || !key) {
    return NextResponse.json({ connected: false, qrCode: null, instance: inst || '' });
  }
  try {
    const stateRes = await fetch(`${base}/instance/connectionState/${encodeURIComponent(inst)}`, { headers: headers() });
    const state = await stateRes.json().catch(() => ({}));
    const connected = state?.instance?.state === 'open';

    let qrCode: string | null = null;
    if (!connected) {
      const connectRes = await fetch(`${base}/instance/connect/${encodeURIComponent(inst)}`, { headers: headers() });
      if (connectRes.ok) {
        const d = await connectRes.json().catch(() => ({}));
        qrCode = d?.base64 ?? null;
      }
    }
    return NextResponse.json({ connected, qrCode, instance: inst });
  } catch {
    return NextResponse.json({ connected: false, qrCode: null, instance: inst });
  }
}

export async function DELETE() {
  const base = BASE_URL();
  const inst = INSTANCE();
  try {
    await fetch(`${base}/instance/logout/${encodeURIComponent(inst)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
