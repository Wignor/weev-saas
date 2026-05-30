import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return NextResponse.json({ templates: [] });

  const businessAccountId = await getSetting(tenantId, 'meta_business_account_id');
  const accessToken       = await getSetting(tenantId, 'meta_access_token');

  if (!businessAccountId || !accessToken) return NextResponse.json({ templates: [] });

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?status=APPROVED&limit=100&access_token=${accessToken}`,
  ).catch(() => null);

  if (!res?.ok) return NextResponse.json({ templates: [] });

  const data = await res.json().catch(() => ({ data: [] })) as { data?: unknown[] };
  return NextResponse.json({ templates: data.data || [] });
}
