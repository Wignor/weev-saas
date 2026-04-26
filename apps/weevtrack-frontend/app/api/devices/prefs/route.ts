import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PREFS_FILE = path.join(process.cwd(), 'data', 'device-prefs.json');

type DevicePrefs = { vehicleType: string; chipNumber?: string; iccid?: string };

function readPrefs(): Record<string, DevicePrefs> {
  try {
    if (!fs.existsSync(PREFS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
  } catch { return {}; }
}

function savePrefs(prefs: Record<string, DevicePrefs>) {
  const dir = path.dirname(PREFS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
}

export async function GET() {
  return NextResponse.json(readPrefs());
}

export async function POST(req: Request) {
  const { deviceId, vehicleType, chipNumber, iccid } = await req.json();
  if (!deviceId) return NextResponse.json({ error: 'Inválido' }, { status: 400 });
  const prefs = readPrefs();
  prefs[String(deviceId)] = { ...(prefs[String(deviceId)] || {}), vehicleType, chipNumber, iccid };
  savePrefs(prefs);
  return NextResponse.json({ success: true });
}
