import { NextResponse } from 'next/server';
import { getTenantBySetupToken, getTenantById } from '@/lib/db';
import { getInstanceStatus } from '@/lib/evolution';

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ connected: false });

    const tenant = await getTenantBySetupToken(token) ?? await (async () => {
      // token might be cleared after setup — check by recent update
      return null;
    })();

    // If setup is complete (no token), try to find by instance
    if (!tenant) return NextResponse.json({ connected: false });

    if (!tenant.evolution_instance) return NextResponse.json({ connected: false });

    const status = await getInstanceStatus(tenant.evolution_instance);
    const connected = status?.state === 'open';
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
