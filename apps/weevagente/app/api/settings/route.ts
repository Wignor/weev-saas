import { NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

const HIDDEN_KEYS = new Set(['kiwify_extra_instance_url', 'n8n_forward_url', 'pause_ttl_seconds']);

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const all = await getAllSettings(tenantId);
    return NextResponse.json(all.filter(s => !HIDDEN_KEYS.has(s.key)));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { key, value } = await req.json();
    await setSetting(tenantId, key, value);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
