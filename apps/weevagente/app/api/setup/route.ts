import { NextResponse } from 'next/server';
import { getTenantBySetupToken, completeTenantSetup } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { createInstance, getQrCode } from '@/lib/evolution';

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const tenant = await getTenantBySetupToken(token);
    if (!tenant) return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 });

    const instance = `wz_${tenant.id.replace(/-/g, '').slice(0, 12)}`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://agente.weevzap.pro'}/api/webhook`;

    await createInstance(instance, webhookUrl).catch(() => {});

    const qrData = await getQrCode(instance).catch(() => null);
    const qrCode = qrData?.base64 ? `data:image/png;base64,${qrData.base64}` : null;

    const hash = await hashPassword(password);
    await completeTenantSetup(tenant.id, hash, instance);

    return NextResponse.json({ ok: true, qrCode });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
