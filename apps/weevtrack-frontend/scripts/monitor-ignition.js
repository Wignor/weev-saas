const fs = require('fs');
const path = require('path');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const TRACCAR_EMAIL = process.env.TRACCAR_EMAIL;
const TRACCAR_PASSWORD = process.env.TRACCAR_PASSWORD;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@weevtrack.com';
const SPEED_LIMIT_KMH = Number(process.env.SPEED_LIMIT_KMH) || 100;
const LOW_BATTERY_THRESHOLD = Number(process.env.LOW_BATTERY_THRESHOLD) || 20;

const SUBS_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');
const STATE_FILE = path.join(__dirname, '..', 'data', 'monitor-state.json');

if (!TRACCAR_EMAIL || !TRACCAR_PASSWORD) {
  console.error('TRACCAR_EMAIL e TRACCAR_PASSWORD são obrigatórios');
  process.exit(1);
}

let webpush;
try {
  webpush = require('web-push');
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch {
  console.error('web-push não encontrado. Execute: npm install');
  process.exit(1);
}

function knotsToKmh(knots) {
  return Math.round(knots * 1.852);
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readSubs() {
  try {
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function getSession() {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: TRACCAR_EMAIL, password: TRACCAR_PASSWORD }),
  });
  if (!res.ok) throw new Error('Login Traccar falhou');
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  return match?.[1] || '';
}

async function sendPush(sub, title, body, url = '/dashboard') {
  try {
    await webpush.sendNotification(sub, JSON.stringify({ title, body, url }));
  } catch (err) {
    if (err.statusCode === 410) {
      const subs = readSubs();
      writeJSON(SUBS_FILE, subs.filter((s) => s.endpoint !== sub.endpoint));
    }
  }
}

async function broadcastPush(subscriptions, title, body, url = '/dashboard') {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ALERTA: ${title} — ${body}`);
  for (const sub of subscriptions) {
    await sendPush(sub, title, body, url);
  }
}

async function getAssignments(headers) {
  try {
    const usersRes = await fetch(`${TRACCAR_URL}/api/users`, { headers });
    if (!usersRes.ok) return {};
    const users = await usersRes.json();
    const clients = users.filter((u) => !u.administrator);
    const map = {}; // deviceId → clientUserId
    await Promise.all(
      clients.map(async (client) => {
        try {
          const devRes = await fetch(`${TRACCAR_URL}/api/devices?userId=${client.id}`, { headers });
          if (!devRes.ok) return;
          const devices = await devRes.json();
          for (const d of devices) map[d.id] = client.id;
        } catch { /* silencioso */ }
      })
    );
    return map;
  } catch {
    return {};
  }
}

async function check() {
  try {
    const subscriptions = readSubs();
    if (subscriptions.length === 0) return;

    const session = await getSession();
    const headers = { Cookie: `JSESSIONID=${session}` };

    const [devRes, posRes, assignments] = await Promise.all([
      fetch(`${TRACCAR_URL}/api/devices`, { headers }),
      fetch(`${TRACCAR_URL}/api/positions`, { headers }),
      getAssignments(headers),
    ]);

    const devices = await devRes.json();
    const positions = await posRes.json();

    // adminSubs: subscriptions de administradores
    // clientSubs: mapa userId → subscriptions do cliente
    const adminSubs = subscriptions.filter((s) => s.administrator);
    const clientSubsMap = {};
    for (const s of subscriptions) {
      if (!s.administrator && s.userId) {
        if (!clientSubsMap[s.userId]) clientSubsMap[s.userId] = [];
        clientSubsMap[s.userId].push(s);
      }
    }

    function subsForDevice(deviceId) {
      const clientId = assignments[deviceId];
      if (clientId) {
        // dispositivo atribuído: notifica só o cliente dono
        return clientSubsMap[clientId] || [];
      }
      // dispositivo livre: notifica só admins
      return adminSubs;
    }
    const prevState = readJSON(STATE_FILE);
    const newState = {};

    for (const pos of positions) {
      const device = devices.find((d) => d.id === pos.deviceId);
      if (!device) continue;

      const id = String(pos.deviceId);
      const prev = prevState[id] || {};
      const speedKmh = knotsToKmh(pos.speed || 0);
      const ignition = pos.attributes?.ignition;
      const battery = pos.attributes?.batteryLevel;
      const moving = speedKmh > 2;

      newState[id] = {
        ignition,
        moving,
        speedKmh,
        battery,
        overspeedActive: prev.overspeedActive || false,
        lowBatteryNotified: prev.lowBatteryNotified || false,
      };

      const targetSubs = subsForDevice(pos.deviceId);

      // --- Ignição ---
      if (ignition !== undefined && prev.ignition !== undefined && prev.ignition !== ignition) {
        const title = ignition ? '🔑 Motor Ligado' : '🔒 Motor Desligado';
        const body = `${device.name} — ${ignition ? 'Veículo foi ligado' : 'Veículo foi desligado'}`;
        await broadcastPush(targetSubs, title, body, `/historico?device=${pos.deviceId}`);
        newState[id].lowBatteryNotified = false;
      }

      // --- Movimento ---
      if (prev.moving !== undefined && prev.moving !== moving) {
        if (moving) {
          await broadcastPush(
            targetSubs,
            '🚗 Veículo em movimento',
            `${device.name} — começou a se mover (${speedKmh} km/h)`,
            `/historico?device=${pos.deviceId}`
          );
        } else if (prev.moving && !moving) {
          await broadcastPush(
            targetSubs,
            '🛑 Veículo parou',
            `${device.name} — parou`,
            `/dashboard`
          );
        }
      }

      // --- Excesso de velocidade ---
      const overSpeed = speedKmh > SPEED_LIMIT_KMH;
      if (overSpeed && !prev.overspeedActive) {
        await broadcastPush(
          targetSubs,
          `🚦 Excesso de velocidade`,
          `${device.name} — ${speedKmh} km/h (limite: ${SPEED_LIMIT_KMH} km/h)`,
          `/dashboard`
        );
        newState[id].overspeedActive = true;
      } else if (!overSpeed) {
        newState[id].overspeedActive = false;
      }

      // --- Bateria fraca (apenas uma vez por ciclo de ignição) ---
      if (battery !== undefined && battery <= LOW_BATTERY_THRESHOLD && !prev.lowBatteryNotified) {
        await broadcastPush(
          targetSubs,
          `🔋 Bateria fraca`,
          `${device.name} — bateria em ${battery}%`,
          `/dashboard`
        );
        newState[id].lowBatteryNotified = true;
      }
    }

    writeJSON(STATE_FILE, { ...prevState, ...newState });
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString('pt-BR')}] Erro:`, err.message);
  }
}

console.log(`WeevTrack — Monitor iniciado (limite velocidade: ${SPEED_LIMIT_KMH} km/h, bateria: ${LOW_BATTERY_THRESHOLD}%)`);
check();
setInterval(check, 30000);
