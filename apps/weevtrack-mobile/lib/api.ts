const BASE = 'https://app.weevtrack.com/api/mobile';

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
}

export interface ApiDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: string;
}

export interface ApiPosition {
  id: number;
  deviceId: number;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  attributes: {
    ignition?: boolean;
    batteryLevel?: number;
    [key: string]: unknown;
  };
}

export interface LoginResult {
  sessionId: string;
  user: ApiUser;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

function bearer(sessionId: string): HeadersInit {
  return { Authorization: `Bearer ${sessionId}` };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return api('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchDevices(sessionId: string): Promise<ApiDevice[]> {
  return api('/devices', { headers: bearer(sessionId) });
}

export async function fetchPositions(sessionId: string): Promise<ApiPosition[]> {
  return api('/positions', { headers: bearer(sessionId) });
}

export async function fetchHistory(
  sessionId: string,
  deviceId: number,
  from: string,
  to: string
): Promise<ApiPosition[]> {
  const params = new URLSearchParams({ deviceId: String(deviceId), from, to });
  return api(`/history?${params}`, { headers: bearer(sessionId) });
}

export function knotsToKmh(knots: number): number {
  return Math.round(knots * 1.852);
}

export function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}
