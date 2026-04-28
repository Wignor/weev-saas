import fs from 'fs';
import path from 'path';

const DIST_FILE = path.join(process.cwd(), 'data', 'distributor_clients.json');

export function readDistClients(): Record<string, number[]> {
  try {
    if (!fs.existsSync(DIST_FILE)) return {};
    return JSON.parse(fs.readFileSync(DIST_FILE, 'utf-8'));
  } catch { return {}; }
}

export function writeDistClients(data: Record<string, number[]>) {
  const dir = path.dirname(DIST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DIST_FILE, JSON.stringify(data, null, 2));
}
