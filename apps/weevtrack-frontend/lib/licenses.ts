import fs from 'fs';
import path from 'path';

const LICENSE_FILE  = path.join(process.cwd(), 'data', 'licenses.json');
const CREDITS_FILE  = path.join(process.cwd(), 'data', 'license_credits.json');

export type LicenseRecord = {
  userId: string;
  expiresAt: string;
  activatedAt: string;
};

export type LicenseMap = Record<string, LicenseRecord>;

export function readLicenses(): LicenseMap {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return {};
    return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
  } catch { return {}; }
}

export function writeLicenses(data: LicenseMap): void {
  const dir = path.dirname(LICENSE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

export function daysLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function licenseStatus(expiresAt: string): 'active' | 'expiring' | 'expired' {
  const days = daysLeft(expiresAt);
  if (days === 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

export function createOrRenewLicense(userId: string, existing?: LicenseRecord): LicenseRecord {
  const now = new Date();
  const base = existing && new Date(existing.expiresAt) > now
    ? new Date(existing.expiresAt)
    : now;
  return {
    userId,
    activatedAt: existing?.activatedAt || now.toISOString(),
    expiresAt: new Date(base.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/* ── License Credits ── */

export type CreditsMap = Record<string, number>;

export function readCredits(): CreditsMap {
  try {
    if (!fs.existsSync(CREDITS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf-8'));
  } catch { return {}; }
}

export function writeCredits(data: CreditsMap): void {
  const dir = path.dirname(CREDITS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(data, null, 2));
}

export function getCredits(distributorId: string): number {
  return readCredits()[distributorId] ?? 0;
}

export function addCredits(distributorId: string, amount: number): number {
  const data = readCredits();
  data[distributorId] = (data[distributorId] ?? 0) + amount;
  writeCredits(data);
  return data[distributorId];
}

export function useCredit(distributorId: string): boolean {
  const data = readCredits();
  if ((data[distributorId] ?? 0) <= 0) return false;
  data[distributorId] -= 1;
  writeCredits(data);
  return true;
}
