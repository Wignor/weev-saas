import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readLicenses, daysLeft, licenseStatus } from '@/lib/licenses';

export async function GET() {
  const cookieStore = await cookies();
  const userRaw = cookieStore.get('wt_user')?.value;
  if (!userRaw) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let user: { id: number; administrator: boolean };
  try { user = JSON.parse(decodeURIComponent(userRaw)); } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const licenses = readLicenses();
  const result: Record<string, { expiresAt: string; daysLeft: number; status: string }> = {};

  for (const [deviceId, lic] of Object.entries(licenses)) {
    if (user.administrator || lic.userId === String(user.id)) {
      result[deviceId] = {
        expiresAt: lic.expiresAt,
        daysLeft: daysLeft(lic.expiresAt),
        status: licenseStatus(lic.expiresAt),
      };
    }
  }

  return NextResponse.json(result);
}
