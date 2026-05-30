import { NextResponse } from 'next/server';
import { getTenantById, getTenantInstances, addTenantInstance } from '@/lib/db';
import { createInstance, getInstanceStatus, getQrCode } from '@/lib/evolution';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const [tenant, instances] = await Promise.all([
      getTenantById(tenantId),
      getTenantInstances(tenantId),
    ]);

    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://agente.weevzap.pro'}/api/webhook`;

    const result = await Promise.all(instances.map(async (inst) => {
      let status = await getInstanceStatus(inst.instance_name).catch(() => ({ state: 'close' }));
      if (!status || status.state === undefined) {
        await createInstance(inst.instance_name, webhookUrl).catch(() => {});
        status = { state: 'close' };
      }
      const connected = status?.state === 'open';
      let qrCode = null;
      if (!connected) {
        const qrData = await getQrCode(inst.instance_name).catch(() => null);
        qrCode = qrData?.base64 ?? null;
      }
      return { ...inst, connected, qrCode };
    }));

    return NextResponse.json({
      instances: result,
      maxInstances: tenant?.max_instances ?? 1,
    });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const tenant = await getTenantById(tenantId);
    if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const instances = await getTenantInstances(tenantId);
    if (instances.length >= (tenant.max_instances ?? 1)) {
      return NextResponse.json({ error: 'limit_reached' }, { status: 403 });
    }

    const { label } = await req.json();
    const instanceName = `wz_${tenantId.replace(/-/g, '').slice(0, 8)}_${Date.now().toString(36)}`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://agente.weevzap.pro'}/api/webhook`;

    await createInstance(instanceName, webhookUrl).catch(() => {});
    const inst = await addTenantInstance(tenantId, instanceName, label || `WhatsApp ${instances.length + 1}`);

    return NextResponse.json({ ok: true, instance: inst });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
