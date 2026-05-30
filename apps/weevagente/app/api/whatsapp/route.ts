import { NextResponse } from 'next/server';
import { getTenantById } from '@/lib/db';
import { createInstance, getInstanceStatus, getQrCode, logoutInstance } from '@/lib/evolution';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const tenant = await getTenantById(tenantId);
    if (!tenant?.evolution_instance) return NextResponse.json({ connected: false, instance: null });

    const instance = tenant.evolution_instance;
    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://agente.weevzap.pro'}/api/webhook`;

    let status = await getInstanceStatus(instance);

    // Auto-create instance if it doesn't exist in Evolution API
    if (!status || status.state === undefined) {
      await createInstance(instance, webhookUrl).catch(() => {});
      status = await getInstanceStatus(instance).catch(() => ({ state: 'close' }));
    }

    const connected = status?.state === 'open';

    let qrCode = null;
    if (!connected) {
      const qrData = await getQrCode(instance).catch(() => null);
      qrCode = qrData?.base64 ?? null;
    }

    return NextResponse.json({ connected, instance, qrCode });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function DELETE(req: Request) {
  try {
    const tenantId = await getTenantId();
    const url = new URL(req.url);
    const instanceParam = url.searchParams.get('instance');

    const tenant = await getTenantById(tenantId);
    const instance = instanceParam || tenant?.evolution_instance;
    if (!instance) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 400 });

    await logoutInstance(instance).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
