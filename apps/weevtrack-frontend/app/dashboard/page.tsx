'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import PushNotificationSetup from '@/components/PushNotificationSetup';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const VehicleMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

/* ── helpers ── */
function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find((r) => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', administrator: false }; }
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function fmtDuration(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${sec}s`;
  return `${sec}s`;
}

function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getStatus(device: TraccarDevice, pos?: TraccarPosition) {
  if (device.status === 'offline' || device.status === 'unknown') return 'offline';
  if (pos && knotsToKmh(pos.speed) > 2) return 'movendo';
  return 'parado';
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /* */ }
}

/* ── DeviceDetail ── */
interface DeviceDetailProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  onClose: () => void;
  onHistory: () => void;
  clientName?: string;
  isAdmin?: boolean;
  variant?: 'sheet' | 'panel';
}

function DeviceDetail({ device, pos, onClose, onHistory, clientName, isAdmin, variant = 'sheet' }: DeviceDetailProps) {
  const [cmdLoading, setCmdLoading] = useState<string | null>(null);
  const [cmdMsg, setCmdMsg] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(device.name);
  const [deviceName, setDeviceName] = useState(device.name);

  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const ignition = pos?.attributes?.ignition;
  const battery = pos?.attributes?.batteryLevel as number | undefined;
  const voltage = pos?.attributes?.power as number | undefined;
  const totalDist = pos?.attributes?.totalDistance as number | undefined;
  const odometerKm = totalDist !== undefined ? Math.round(totalDist / 1000).toLocaleString('pt-BR') + ' km' : '—';
  const voltageStr = voltage !== undefined ? `${voltage.toFixed(1)}V` : '—';
  const powerSource = voltage !== undefined ? (voltage > 10 ? 'Com fio' : 'Bateria') : battery !== undefined ? 'Bateria' : '—';

  const sColor: Record<string, string> = { movendo: '#34C759', parado: '#FF9500', offline: '#6B7280' };
  const sBg: Record<string, string> = { movendo: 'rgba(52,199,89,0.15)', parado: 'rgba(255,149,0,0.15)', offline: 'rgba(107,114,128,0.15)' };
  const sLabel: Record<string, string> = { movendo: 'Movendo', parado: 'Estático', offline: 'Offline' };
  const statusSince = pos?.deviceTime || device.lastUpdate;
  const statusStr = `${sLabel[status]}${statusSince ? ' ' + fmtDuration(statusSince) : ''} GPS`;
  const canControl = !clientName || isAdmin;

  async function sendCommand(type: string, label: string) {
    setCmdLoading(type); setCmdMsg('');
    try {
      const res = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, type }) });
      const data = await res.json();
      setCmdMsg(res.ok ? `✅ ${label} enviado` : `❌ ${data.error || 'Falha'}`);
    } catch { setCmdMsg('❌ Erro de conexão'); }
    finally { setCmdLoading(null); setTimeout(() => setCmdMsg(''), 4000); }
  }

  async function doRename() {
    if (!renameVal.trim() || renameVal.trim() === deviceName) { setRenaming(false); return; }
    try {
      const res = await fetch('/api/admin/devices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, name: renameVal.trim() }) });
      if (res.ok) { setDeviceName(renameVal.trim()); setCmdMsg('✅ Renomeado'); }
      else { setCmdMsg('❌ Erro ao renomear'); }
    } catch { setCmdMsg('❌ Erro de conexão'); }
    setRenaming(false); setTimeout(() => setCmdMsg(''), 3000);
  }

  function shareLocation() {
    if (!pos) return;
    const url = `https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`;
    if (navigator.share) { navigator.share({ title: deviceName, text: `Localização de ${deviceName}`, url }); }
    else { navigator.clipboard.writeText(url); setCmdMsg('✅ Link copiado!'); setTimeout(() => setCmdMsg(''), 3000); }
  }

  const inner = (
    <div style={{ padding: variant === 'panel' ? '16px' : '20px', paddingBottom: variant === 'sheet' ? '5rem' : '16px' }}>
      {variant === 'sheet' && <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--bg-border)' }} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
                className="flex-1 rounded-lg px-2 py-1 text-base font-bold focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid #007AFF' }} />
              <button onClick={doRename} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,199,89,0.15)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button onClick={() => setRenaming(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,59,48,0.1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg truncate" style={{ color: 'var(--text-hi)' }}>{deviceName}</h2>
              {isAdmin && (
                <button onClick={() => { setRenameVal(deviceName); setRenaming(true); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,122,255,0.1)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-lo)' }}>{device.uniqueId}</p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {variant === 'panel' && (
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sBg[status], color: sColor[status] }}>
            {statusStr}
          </span>
        </div>
      </div>

      {cmdMsg && (
        <p className="text-xs text-center mb-3 font-medium py-2 rounded-lg"
          style={{ background: cmdMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: cmdMsg.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
          {cmdMsg}
        </p>
      )}

      {/* Address */}
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2" style={{ background: 'var(--bg-input)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        </svg>
        <p className="flex-1 text-xs leading-relaxed" style={{ color: pos?.address ? 'var(--text-mid)' : 'var(--text-lo)' }}>
          {pos?.address || 'Endereço não disponível'}
        </p>
        {pos && (
          <button onClick={() => window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1" style={{ background: 'rgba(0,122,255,0.15)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { icon: '🕐', label: 'Servidor',   value: fmtDateTime(pos?.serverTime) },
          { icon: '📡', label: 'GPS Fix',    value: fmtDateTime(pos?.fixTime) },
          { icon: '🔌', label: 'Fonte',      value: powerSource, color: voltage && voltage > 10 ? '#34C759' : 'var(--text-lo)' },
          { icon: '🔑', label: 'Ignição',    value: ignition === true ? 'Ligada' : ignition === false ? 'Desligada' : '—', color: ignition === true ? '#34C759' : ignition === false ? '#FF3B30' : 'var(--text-lo)' },
          { icon: '⚡', label: 'Tensão',     value: voltageStr, color: voltage ? (voltage > 11 ? '#34C759' : '#FF9500') : 'var(--text-lo)' },
          { icon: '🏁', label: 'Odômetro',   value: odometerKm },
          { icon: '🚀', label: 'Velocidade', value: `${speed} km/h`, color: speed > 0 ? '#007AFF' : 'var(--text-lo)' },
          { icon: '🔋', label: 'Bateria',    value: battery !== undefined ? `${battery}%` : powerSource === 'Com fio' ? 'Com fio' : '—', color: battery !== undefined ? (battery > 20 ? '#34C759' : '#FF3B30') : 'var(--text-lo)' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl p-2.5" style={{ background: 'var(--bg-input)' }}>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-lo)' }}>{item.icon} {item.label}</p>
            <p className="text-xs font-semibold leading-tight" style={{ color: item.color || 'var(--text-mid)' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {pos && <p className="text-xs text-center mb-3" style={{ color: 'var(--text-lo)' }}>{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}</p>}

      {clientName && (
        <div className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)' }}>
          <span>👤</span>
          <p className="text-xs" style={{ color: 'var(--text-mid)' }}>Cliente: <span className="font-semibold" style={{ color: '#FF9500' }}>{clientName}</span></p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {canControl && (
          <button onClick={() => sendCommand('engineStop', 'Bloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)', minWidth: '64px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#FF3B30' }}>{cmdLoading === 'engineStop' ? '...' : 'Bloquear'}</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => sendCommand('engineResume', 'Desbloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '64px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#34C759' }}>{cmdLoading === 'engineResume' ? '...' : 'Desbloquear'}</span>
          </button>
        )}
        <button onClick={onHistory} className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0"
          style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)', minWidth: '64px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span className="text-xs font-medium" style={{ color: '#007AFF' }}>Trajetos</span>
        </button>
        <button onClick={shareLocation} disabled={!pos} className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-40"
          style={{ background: 'rgba(88,86,214,0.12)', border: '1px solid rgba(88,86,214,0.2)', minWidth: '64px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span className="text-xs font-medium" style={{ color: '#5856D6' }}>Compartilhar</span>
        </button>
        <button onClick={() => pos && window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
          disabled={!pos} className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-40"
          style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '64px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <span className="text-xs font-medium" style={{ color: '#34C759' }}>Google Maps</span>
        </button>
      </div>
    </div>
  );

  if (variant === 'panel') return <div className="h-full overflow-y-auto">{inner}</div>;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="slide-up rounded-t-2xl" style={{ background: 'var(--bg-card)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        {inner}
      </div>
    </div>
  );
}

/* ── DeviceListItem — MUST be outside DashboardPage ── */
interface ListItemProps {
  device: TraccarDevice; pos?: TraccarPosition;
  isSelected: boolean; clientName: string; onSelect: () => void;
}

function DeviceListItem({ device, pos, isSelected, clientName, onSelect }: ListItemProps) {
  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const ignition = pos?.attributes?.ignition;
  const sBadge: Record<string, string> = { movendo: 'badge-online', parado: 'badge-parado', offline: 'badge-offline' };
  const sLabel: Record<string, string> = { movendo: 'Movendo', parado: 'Estático', offline: 'Offline' };

  return (
    <button onClick={onSelect} className="w-full text-left px-4 py-3 transition-all"
      style={{ background: isSelected ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--bg-border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isSelected ? 'rgba(0,122,255,0.2)' : 'var(--bg-card)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={isSelected ? '#007AFF' : status === 'offline' ? '#6B7280' : status === 'movendo' ? '#34C759' : '#FF9500'}
            strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
            <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-hi)' }}>{device.name}</span>
            {clientName ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>👤 {clientName}</span>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sBadge[status]}`}>{sLabel[status]}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-lo)' }}>
            <span className="font-mono">{device.uniqueId.slice(-8)}</span>
            <span>{ignition ? '🔑 ON' : '🔑 OFF'}</span>
            {speed > 0 && <span>⚡ {speed}km/h</span>}
            <span>{device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}</span>
          </div>
          {pos?.address && <p className="text-xs mt-1 truncate opacity-60" style={{ color: 'var(--text-lo)' }}>📍 {pos.address}</p>}
        </div>
      </div>
    </button>
  );
}

/* ── Main page ── */
export default function DashboardPage() {
  const [asUser, setAsUser] = useState<string | null>(null);
  const [asUserName, setAsUserName] = useState<string | null>(null);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<'lista' | 'mapa'>('lista');
  const [filter, setFilter] = useState<'todos' | 'online' | 'offline'>('todos');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState({ name: '', administrator: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setAsUser(p.get('asUser'));
    setAsUserName(p.get('asUserName'));
  }, []);

  useEffect(() => {
    const u = getUserFromCookie();
    setUser(u);
    if (u.administrator && !asUser) {
      fetch('/api/admin/assignments').then(r => r.json()).then(data => {
        if (data && typeof data === 'object') setAssignments(data);
      }).catch(() => {});
    }
  }, [asUser]);

  const fetchData = useCallback(async () => {
    try {
      const suffix = asUser ? `?asUser=${asUser}` : '';
      const [devRes, posRes] = await Promise.all([fetch(`/api/devices${suffix}`), fetch(`/api/positions${suffix}`)]);
      if (devRes.status === 401) { window.location.href = '/login'; return; }
      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) setPositions(posData);
      setLastUpdate(new Date());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [asUser]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));
  const online = devices.filter((d) => d.status === 'online').length;
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const filteredDevices = devices.filter(d => {
    if (filter === 'online' && d.status !== 'online') return false;
    if (filter === 'offline' && d.status === 'online') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.uniqueId.includes(search)) return false;
    return true;
  });

  const desktopNavTabs = [
    { href: '/dashboard', label: 'Monitor', icon: 'M12 2v2M12 20v2M2 12h2M20 12h2' },
    { href: '/historico', label: 'Trajetos', icon: '' },
    { href: '/alertas', label: 'Alertas', icon: '' },
    { href: '/perfil', label: 'Perfil', icon: '' },
    ...(user.administrator ? [{ href: '/gestao', label: 'Gestão', icon: '' }] : []),
  ];

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-20"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" fill="white"/>
              <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--text-hi)' }}>WeevTrack</span>
          {asUserName && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>
              👤 {asUserName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs badge-online px-2 py-0.5 rounded-full font-medium">{online} online</span>
          <span className="text-xs badge-offline px-2 py-0.5 rounded-full font-medium">{devices.length - online} offline</span>
          {asUser ? (
            <a href="/dashboard" className="text-xs px-2.5 py-1 rounded-lg font-medium no-underline"
              style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>✕ Sair</a>
          ) : (
            <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-border)' }} title="Alternar tema">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>
          )}
          {lastUpdate && (
            <span className="text-xs hidden md:block" style={{ color: 'var(--text-lo)' }}>
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* ── Desktop nav tabs (below header, desktop only) ── */}
      <div className="hidden md:flex flex-shrink-0 px-4 gap-1"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', paddingTop: '6px', paddingBottom: '6px' }}>
        {[
          { href: '/dashboard', label: 'Monitor' },
          { href: '/historico', label: 'Trajetos' },
          { href: '/alertas', label: 'Alertas' },
          ...(user.administrator ? [{ href: '/gestao', label: 'Gestão' }] : []),
          { href: '/perfil', label: 'Perfil' },
        ].map(tab => {
          const active = typeof window !== 'undefined' && window.location.pathname === tab.href;
          return (
            <a key={tab.href} href={tab.href}
              className="px-4 py-1.5 rounded-lg text-sm font-medium no-underline transition-all"
              style={{ background: active ? '#007AFF' : 'transparent', color: active ? 'white' : 'var(--text-lo)' }}>
              {tab.label}
            </a>
          );
        })}
        {lastUpdate && (
          <span className="ml-auto text-xs self-center" style={{ color: 'var(--text-lo)' }}>
            Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Mobile view toggle ── */}
      <div className="md:hidden flex-shrink-0 flex px-4 py-2 gap-2"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {(['lista', 'mapa'] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: mobileView === v ? '#007AFF' : 'transparent', color: mobileView === v ? 'white' : 'var(--text-lo)' }}>
            {v === 'lista' ? 'Lista' : 'Mapa'}
          </button>
        ))}
        {lastUpdate && (
          <span className="text-xs self-center ml-1" style={{ color: 'var(--text-lo)' }}>
            {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <PushNotificationSetup />

      {/* ── Main layout ──
          Desktop: flex-row [sidebar 280px | map flex-1 | detail 360px]
          Mobile:  map fills all, list is an absolute overlay on top
      ── */}
      <div className="flex-1 flex overflow-hidden" style={{ position: 'relative', minHeight: 0 }}>

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col flex-none overflow-hidden"
          style={{ width: '280px', borderRight: '1px solid var(--bg-border)', background: 'var(--bg-page)' }}>
          <div className="flex-shrink-0 p-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
            </div>
            <div className="flex gap-1">
              {(['todos', 'online', 'offline'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="flex-1 text-xs py-1 rounded-lg font-medium transition-all"
                  style={{ background: filter === f ? '#007AFF' : 'var(--bg-input)', color: filter === f ? 'white' : 'var(--text-lo)' }}>
                  {f === 'todos' ? `Todos (${devices.length})` : f === 'online' ? `Online (${online})` : `Offline (${devices.length - online})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-12 px-6"><p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p></div>
            ) : (
              filteredDevices.map(device => (
                <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                  isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                  onSelect={() => setSelectedId(selectedId === device.id ? null : device.id)} />
              ))
            )}
          </div>
        </div>

        {/* Map — always mounted and filling flex-1, provides correct dimensions for Leaflet */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <VehicleMap
            devices={devices} positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={(id) => { setSelectedId(id); setMobileView('mapa'); }}
            visible={mobileView === 'mapa'}
          />
        </div>

        {/* Desktop detail panel */}
        {selectedId && selectedDevice && (
          <div className="hidden md:flex flex-col flex-none overflow-hidden"
            style={{ width: '360px', borderLeft: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
            <DeviceDetail device={selectedDevice} pos={posMap[selectedId]}
              onClose={() => setSelectedId(null)}
              onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
              clientName={assignments[selectedId]} isAdmin={user.administrator} variant="panel" />
          </div>
        )}

        {/* Mobile list overlay — sits OVER the map, shown when in lista view */}
        <div className="md:hidden"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10,
            background: 'var(--bg-page)',
            display: mobileView === 'lista' ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p>
              </div>
            ) : (
              filteredDevices.map(device => (
                <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                  isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                  onSelect={() => setSelectedId(selectedId === device.id ? null : device.id)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />

      {/* ── Mobile bottom sheet ── */}
      {selectedId && selectedDevice && (
        <div className="md:hidden">
          <DeviceDetail device={selectedDevice} pos={posMap[selectedId]}
            onClose={() => setSelectedId(null)}
            onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
            clientName={assignments[selectedId]} isAdmin={user.administrator} variant="sheet" />
        </div>
      )}
    </div>
  );
}
