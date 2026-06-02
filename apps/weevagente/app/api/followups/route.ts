import { NextResponse } from 'next/server';
import { getFollowupConfigs, upsertFollowupConfig } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    return NextResponse.json(await getFollowupConfigs(tenantId));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const { step_order, enabled, delay_minutes, message, file_url, file_type, file_name } = body;
    if (!step_order || step_order < 1 || step_order > 5) return NextResponse.json({ error: 'step_order inválido (1-5)' }, { status: 400 });
    await upsertFollowupConfig(tenantId, step_order, { enabled: !!enabled, delay_minutes: parseInt(delay_minutes) || 60, message: message || '', file_url, file_type, file_name });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
