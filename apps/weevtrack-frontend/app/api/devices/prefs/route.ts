import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PREFS_FILE = path.join(process.cwd(), 'data', 'device-prefs.json');

function readPrefs(): Record<string, { vehicleType: string }> {
  try {
    if (!fs.existsSync(PREFS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
  } catch { return {}; }
}

function savePrefs(prefs: Record<string, { vehicleType: string }>) {
  const dir = path.dirname(PREFS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
}

export async function GET() {
  return NextResponse.json(readPrefs());
}

export async function POST(req: Request) {
  const { deviceId, vehicleType } = await req.json();
  if (!deviceId || !vehicleType) return NextResponse.json({ error: 'Inválido' }, { status: 400 });
  const prefs = readPrefs();
  prefs[String(deviceId)] = { vehicleType };
  savePrefs(prefs);
  return NextResponse.json({ success: true });
}
