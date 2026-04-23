const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: string;
  groupId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string | null;
  attributes: {
    ignition?: boolean;
    batteryLevel?: number;
    distance?: number;
    totalDistance?: number;
    [key: string]: unknown;
  };
}

export async function traccarLogin(email: string, password: string): Promise<{ user: TraccarUser; sessionId: string }> {
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }),
  });

  if (!res.ok) throw new Error('Credenciais inválidas');

  const user: TraccarUser = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  const sessionId = match?.[1] || '';

  return { user, sessionId };
}

export async function traccarGet<T>(path: string, sessionId: string): Promise<T> {
  const res = await fetch(`${TRACCAR_URL}${path}`, {
    headers: { Cookie: `JSESSIONID=${sessionId}` },
    cache: 'no-store',
  });

  if (res.status === 401) throw new Error('Sessão expirada');
  if (!res.ok) throw new Error(`Erro Traccar: ${res.status}`);

  return res.json() as Promise<T>;
}

export async function traccarLogout(sessionId: string): Promise<void> {
  await fetch(`${TRACCAR_URL}/api/session`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${sessionId}` },
  });
}

export function knotsToKmh(knots: number): number {
  return Math.round(knots * 1.852);
}

export function deviceStatus(device: TraccarDevice): 'online' | 'parado' | 'offline' {
  if (device.status === 'offline' || device.status === 'unknown') return 'offline';
  return 'online';
}
