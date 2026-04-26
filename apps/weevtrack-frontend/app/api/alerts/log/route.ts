import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'alerts-log.json');

type AlertEntry = {
  id: number;
  deviceId: number;
  deviceName: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
  userIds: string[];
};

function readLog(): AlertEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function getUserFromCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    const raw = cookieStore.get('wt_user')?.value;
    if (raw) return JSON.parse(decodeURIComponent(raw));
  } catch { /**/ }
  return null;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const user = getUserFromCookie(cookieStore);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFilter = searchParams.get('date'); // YYYY-MM-DD

  let alerts = readLog();

  if (dateFilter) {
    alerts = alerts.filter(a => {
      const localDate = new Date(a.timestamp).toLocaleDateString('sv-SE', {
        timeZone: 'America/Sao_Paulo',
      });
      return localDate === dateFilter;
    });
  }

  if (!user.administrator) {
    const userId = String(user.id);
    alerts = alerts.filter(a => Array.isArray(a.userIds) && a.userIds.includes(userId));
  }

  return NextResponse.json(alerts.slice(0, 300));
}
