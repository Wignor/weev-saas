import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ email: null, tenantId: null }, { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ email: null, tenantId: null }, { status: 401 });
  return NextResponse.json({ email: session.email, tenantId: session.tenantId, role: session.role ?? 'admin', sectorId: session.sectorId ?? null, operatorId: session.operatorId ?? null });
}
