import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ALERTS_LOG_FILE = path.join(process.cwd(), 'data', 'alerts-log.json');

const CMD_CONFIG: Record<string, { alertType: string; title: string; body: (name: string) => string }> = {
  engineStop:   { alertType: 'commandBlock',   title: '🔒 Veículo Bloqueado',    body: (n) => `${n} — comando de bloqueio enviado` },
  engineResume: { alertType: 'commandUnblock', title: '🔓 Veículo Desbloqueado', body: (n) => `${n} — comando de desbloqueio enviado` },
};

function logCommandAlert(deviceId: number, deviceName: string, alertType: string, title: string, body: string, userIds: string[]) {
  try {
    const entry = { id: Date.now(), deviceId, deviceName, type: alertType, title, body, timestamp: new Date().toISOString(), userIds };
    let log: unknown[] = [];
    if (fs.existsSync(ALERTS_LOG_FILE)) {
      try { log = JSON.parse(fs.readFileSync(ALERTS_LOG_FILE, 'utf-8')); } catch { /**/ }
    }
    if (!Array.isArray(log)) log = [];
    log.unshift(entry);
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    log = (log as { timestamp: string }[]).filter(e => new Date(e.timestamp).getTime() > sixtyDaysAgo);
    const dir = path.dirname(ALERTS_LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ALERTS_LOG_FILE, JSON.stringify(log.slice(0, 1000), null, 2));
  } catch { /**/ }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { deviceId, type } = await req.json();
  if (!deviceId || !type) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

  const res = await fetch(`${TRACCAR_URL}/api/commands/send`, {
    method: 'POST',
    headers: {
      'Cookie': `JSESSIONID=${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceId, type, textChannel: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err || 'Falha ao enviar comando' }, { status: res.status });
  }

  // Loga no histórico de alertas se for bloqueio/desbloqueio
  const cmdCfg = CMD_CONFIG[type];
  if (cmdCfg) {
    // Determina a quem pertence o log (admin ou cliente)
    let userIds: string[] = ['admin'];
    try {
      const raw = cookieStore.get('wt_user')?.value;
      if (raw) {
        const u = JSON.parse(decodeURIComponent(raw));
        if (!u.administrator) userIds = [String(u.id)];
      }
    } catch { /**/ }

    // Busca o nome do dispositivo no Traccar
    let deviceName = `Dispositivo ${deviceId}`;
    try {
      const devRes = await fetch(`${TRACCAR_URL}/api/devices?id=${deviceId}`, {
        headers: { Cookie: `JSESSIONID=${session}` },
      });
      if (devRes.ok) {
        const devs = await devRes.json();
        if (devs[0]?.name) deviceName = devs[0].name;
      }
    } catch { /**/ }

    logCommandAlert(deviceId, deviceName, cmdCfg.alertType, cmdCfg.title, cmdCfg.body(deviceName), userIds);
  }

  return NextResponse.json({ success: true });
}
