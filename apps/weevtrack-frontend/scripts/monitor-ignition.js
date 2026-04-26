const fs = require('fs');
const path = require('path');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const TRACCAR_EMAIL = process.env.TRACCAR_EMAIL;
const TRACCAR_PASSWORD = process.env.TRACCAR_PASSWORD;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@weevtrack.com';
const SPEED_LIMIT_KMH = Number(process.env.SPEED_LIMIT_KMH) || 100; // fallback global
const LOW_BATTERY_THRESHOLD = Number(process.env.LOW_BATTERY_THRESHOLD) || 20;
const PARKING_MINUTES = Number(process.env.PARKING_MINUTES) || 5;

const SUBS_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');
const STATE_FILE = path.join(__dirname, '..', 'data', 'monitor-state.json');
const PREFS_FILE = path.join(__dirname, '..', 'data', 'notification-prefs.json');

const DEFAULT_PREFS = {
  ignitionOn: true, ignitionOff: true, moving: false,
  overspeed: false, speedLimit: 100,
  parking: false, lowBattery: false, sos: true, collision: true,
};

function readPrefs() {
  try {
    if (!fs.existsSync(PREFS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
  } catch { return {}; }
}

function getPrefsForUser(userId) {
  const prefs = readPrefs();
  return { ...DEFAULT_PREFS, ...(prefs[String(userId)] || {}) };
}

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
  } catch { return {}; }
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
  } catch { return []; }
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
    console.log(`[push] OK → ${sub.endpoint.slice(-30)}`);
  } catch (err) {
    console.error(`[push] ERRO ${err.statusCode || err.message} → ${sub.endpoint.slice(-30)}`);
    if (err.statusCode === 410 || err.statusCode === 404) {
      const subs = readSubs();
      writeJSON(SUBS_FILE, subs.filter((s) => s.endpoint !== sub.endpoint));
      console.log(`[push] Subscrição removida (endpoint inválido)`);
    }
  }
}

// meta: { speedKmh } para overspeed com limite por usuário
async function broadcastPush(subscriptions, eventType, title, body, url = '/dashboard', meta = {}) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ALERTA: ${title} — ${body}`);
  for (const sub of subscriptions) {
    const prefs = getPrefsForUser(sub.userId);
    if (!prefs[eventType]) continue;
    if (eventType === 'overspeed' && meta.speedKmh !== undefined) {
      const userLimit = Number(prefs.speedLimit) || SPEED_LIMIT_KMH;
      if (meta.speedKmh <= userLimit) continue;
    }
    await sendPush(sub, title, body, url);
  }
}

async function getAssignments(headers) {
  try {
    const usersRes = await fetch(`${TRACCAR_URL}/api/users`, { headers });
    if (!usersRes.ok) return {};
    const users = await usersRes.json();
    const clients = users.filter((u) => !u.administrator);
    const map = {};
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
  } catch { return {}; }
}

async function getRecentEvents(headers, fromTime) {
  try {
    const from = new Date(fromTime).toISOString();
    const to = new Date().toISOString();
    const url = `${TRACCAR_URL}/api/reports/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=alarm`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// Dedup de eventos já processados
const processedEventIds = new Set();
let lastEventsCheck = Date.now();

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

    const adminSubs = subscriptions.filter((s) => s.administrator || !s.userId);
    const clientSubsMap = {};
    for (const s of subscriptions) {
      if (!s.administrator && s.userId) {
        if (!clientSubsMap[s.userId]) clientSubsMap[s.userId] = [];
        clientSubsMap[s.userId].push(s);
      }
    }

    function subsForDevice(deviceId) {
      const clientId = assignments[deviceId];
      const clientSubs = clientId ? (clientSubsMap[clientId] || []) : [];
      if (clientSubs.length > 0) return clientSubs;
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

      // Calcula menor limite de velocidade entre as subs do dispositivo para detecção de estado
      const targetSubs = subsForDevice(pos.deviceId);
      const enabledOvSubs = targetSubs.filter(s => getPrefsForUser(s.userId).overspeed);
      const minSpeedLimit = enabledOvSubs.length > 0
        ? Math.min(...enabledOvSubs.map(s => Number(getPrefsForUser(s.userId).speedLimit) || SPEED_LIMIT_KMH))
        : SPEED_LIMIT_KMH;

      newState[id] = {
        ignition,
        moving,
        speedKmh,
        battery,
        overspeedActive: prev.overspeedActive || false,
        lowBatteryNotified: prev.lowBatteryNotified || false,
        stoppedAt: prev.stoppedAt || null,
        parkingNotified: prev.parkingNotified || false,
      };

      // --- Ignição ---
      if (ignition !== undefined && prev.ignition !== undefined && prev.ignition !== ignition) {
        const title = ignition ? '🔑 Motor Ligado' : '🔒 Motor Desligado';
        const body = `${device.name} — ${ignition ? 'Veículo foi ligado' : 'Veículo foi desligado'}`;
        await broadcastPush(targetSubs, ignition ? 'ignitionOn' : 'ignitionOff', title, body, `/historico?device=${pos.deviceId}`);
        newState[id].lowBatteryNotified = false;
      }

      // --- Movimento ---
      if (prev.moving !== undefined && prev.moving !== moving) {
        if (moving) {
          await broadcastPush(targetSubs, 'moving', '🚗 Veículo em movimento', `${device.name} — começou a se mover (${speedKmh} km/h)`, `/historico?device=${pos.deviceId}`);
        } else {
          await broadcastPush(targetSubs, 'moving', '🛑 Veículo parou', `${device.name} — parou`, `/dashboard`);
        }
      }

      // --- Estacionamento prolongado ---
      if (moving) {
        newState[id].stoppedAt = null;
        newState[id].parkingNotified = false;
      } else {
        if (prev.moving === true) {
          // Acabou de parar
          newState[id].stoppedAt = Date.now();
          newState[id].parkingNotified = false;
        } else {
          newState[id].stoppedAt = prev.stoppedAt || null;
          newState[id].parkingNotified = prev.parkingNotified || false;
        }
        const stoppedAt = newState[id].stoppedAt;
        const parkingMs = PARKING_MINUTES * 60 * 1000;
        if (stoppedAt && !newState[id].parkingNotified && (Date.now() - stoppedAt) >= parkingMs) {
          await broadcastPush(targetSubs, 'parking', '🅿️ Veículo estacionado',
            `${device.name} — parado há mais de ${PARKING_MINUTES} minutos`, `/historico?device=${pos.deviceId}`);
          newState[id].parkingNotified = true;
        }
      }

      // --- Excesso de velocidade ---
      const overSpeed = speedKmh > minSpeedLimit;
      if (overSpeed && !prev.overspeedActive) {
        await broadcastPush(targetSubs, 'overspeed', `🚦 Excesso de velocidade`,
          `${device.name} — ${speedKmh} km/h`, `/dashboard`, { speedKmh });
        newState[id].overspeedActive = true;
      } else if (!overSpeed) {
        newState[id].overspeedActive = false;
      }

      // --- Bateria fraca do aparelho (batteryLevel = bateria interna do rastreador) ---
      if (battery !== undefined && battery <= LOW_BATTERY_THRESHOLD && !prev.lowBatteryNotified) {
        await broadcastPush(targetSubs, 'lowBattery', `🔋 Bateria do aparelho fraca`,
          `${device.name} — bateria interna em ${battery}%`, `/dashboard`);
        newState[id].lowBatteryNotified = true;
      }
    }

    writeJSON(STATE_FILE, { ...prevState, ...newState });

    // --- Eventos de alarme: SOS e Colisão ---
    const eventsFrom = lastEventsCheck - 2000; // 2s de overlap para evitar gaps
    lastEventsCheck = Date.now();
    const events = await getRecentEvents(headers, eventsFrom);

    for (const ev of events) {
      if (processedEventIds.has(ev.id)) continue;
      processedEventIds.add(ev.id);

      const evDevice = devices.find(d => d.id === ev.deviceId);
      if (!evDevice) continue;
      const evSubs = subsForDevice(ev.deviceId);
      const alarm = ev.attributes?.alarm;

      if (alarm === 'sos') {
        await broadcastPush(evSubs, 'sos', '🆘 SOS — Botão de pânico!',
          `${evDevice.name} — botão de pânico acionado`, `/dashboard`);
      }

      if (['vibration', 'hardBraking', 'hardAcceleration', 'hardCornering'].includes(alarm)) {
        await broadcastPush(evSubs, 'collision', '💥 Possível colisão detectada',
          `${evDevice.name} — impacto ou vibração forte (${alarm})`, `/dashboard`);
      }
    }

    // Limpa IDs antigos para não crescer indefinidamente
    if (processedEventIds.size > 500) processedEventIds.clear();

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString('pt-BR')}] Erro:`, err.message);
  }
}

console.log(`WeevTrack — Monitor iniciado (velocidade mínima: ${SPEED_LIMIT_KMH} km/h, bateria: ${LOW_BATTERY_THRESHOLD}%, estacionamento: ${PARKING_MINUTES} min)`);
check();
setInterval(check, 10000);
