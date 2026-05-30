import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export async function GET() {
  const businessAccountId = await getSetting('meta_business_account_id');
  const accessToken       = await getSetting('meta_access_token');

  if (!businessAccountId || !accessToken) return NextResponse.json({ templates: [] });

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?status=APPROVED&limit=100&access_token=${accessToken}`,
  ).catch(() => null);

  if (!res?.ok) return NextResponse.json({ templates: [] });

  const data = await res.json().catch(() => ({ data: [] })) as { data?: unknown[] };
  return NextResponse.json({ templates: data.data || [] });
}
