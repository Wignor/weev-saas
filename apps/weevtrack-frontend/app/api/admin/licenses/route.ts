import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readLicenses, writeLicenses, createOrRenewLicense, createOrRenewLicenseByMonths, daysLeft, licenseStatus } from '@/lib/licenses';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userRaw = cookieStore.get('wt_user')?.value;
  if (!userRaw) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let admin: { administrator: boolean };
  try { admin = JSON.parse(decodeURIComponent(userRaw)); } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (!admin.administrator) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { deviceId, userId, days, months } = await req.json();
  if (!deviceId || !userId) return NextResponse.json({ error: 'deviceId e userId são obrigatórios' }, { status: 400 });

  const licenses = readLicenses();
  const key = String(deviceId);
  if (typeof months === 'number' && months > 0) {
    licenses[key] = createOrRenewLicenseByMonths(String(userId), licenses[key], months);
  } else {
    const addDays = typeof days === 'number' && days !== 0 ? days : 31;
    licenses[key] = createOrRenewLicense(String(userId), licenses[key], addDays);
  }
  writeLicenses(licenses);

  return NextResponse.json({
    success: true,
    expiresAt: licenses[key].expiresAt,
    daysLeft: daysLeft(licenses[key].expiresAt),
    status: licenseStatus(licenses[key].expiresAt),
  });
}
