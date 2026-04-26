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

function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find((r) => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', administrator: false }; }
}

function timeOffline(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  return `${mins}m`;
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

type DeviceStatus = 'movendo' | 'parado' | 'offline' | 'expirado';

function getStatus(device: TraccarDevice, pos?: TraccarPosition): DeviceStatus {
  if (device.status === 'online') {
    if (pos && knotsToKmh(pos.speed) > 2) return 'movendo';
    return 'parado';
  }
  if (device.lastUpdate) {
    if ((Date.now() - new Date(device.lastUpdate).getTime()) / 86400000 > 7) return 'expirado';
  }
  return 'offline';
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

const S_COLOR: Record<DeviceStatus, string> = {
  movendo: '#34C759', parado: '#FF9500', offline: '#6B7280', expirado: '#FF3B30',
};
const S_BG: Record<DeviceStatus, string> = {
  movendo: 'rgba(52,199,89,0.15)', parado: 'rgba(255,149,0,0.15)',
  offline: 'rgba(107,114,128,0.15)', expirado: 'rgba(255,59,48,0.15)',
};
const S_LABEL: Record<DeviceStatus, string> = {
  movendo: 'Movendo', parado: 'Estático', offline: 'Offline', expirado: 'Expirado',
};

/* ── DeviceDetail ── */
interface DeviceDetailProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  onClose: () => void;
  onHistory: () => void;
  onCenter?: () => void;
  clientName?: string;
  isAdmin?: boolean;
  variant?: 'sheet' | 'panel';
}

function DeviceDetail({ device, pos, onClose, onHistory, onCenter, clientName, isAdmin, variant = 'sheet' }: DeviceDetailProps) {
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
  const statusSince = pos?.deviceTime || device.lastUpdate;
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

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', paddingBottom: variant === 'sheet' ? '1.5rem' : '16px' }}>
      {variant === 'sheet' && <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--bg-border)' }} />}

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
              <h2 className="font-bold text-base truncate" style={{ color: 'var(--text-hi)' }}>{deviceName}</h2>
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
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: S_BG[status], color: S_COLOR[status] }}>
            {S_LABEL[status]}{statusSince ? ` ${fmtDuration(statusSince)}` : ''}
          </span>
        </div>
      </div>

      {cmdMsg && (
        <p className="text-xs text-center mb-3 font-medium py-2 rounded-lg"
          style={{ background: cmdMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: cmdMsg.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
          {cmdMsg}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-3">
        {onCenter && (
          <button onClick={onCenter} disabled={!pos}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-1 disabled:opacity-40"
            style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#007AFF', fontSize: '10px' }}>Rastrear</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => sendCommand('engineStop', 'Bloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-1 disabled:opacity-50"
            style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="font-medium" style={{ color: '#FF3B30', fontSize: '10px' }}>{cmdLoading === 'engineStop' ? '...' : 'Bloquear'}</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => sendCommand('engineResume', 'Desbloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-1 disabled:opacity-50"
            style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              <polyline points="16 5 19 8 22 5"/>
            </svg>
            <span className="font-medium" style={{ color: '#34C759', fontSize: '10px' }}>{cmdLoading === 'engineResume' ? '...' : 'Desbloquear'}</span>
          </button>
        )}
        <button onClick={shareLocation} disabled={!pos}
          className="flex flex-col items-center gap-1 rounded-xl py-2 flex-1 disabled:opacity-40"
          style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.15)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span className="font-medium" style={{ color: '#007AFF', fontSize: '10px' }}>Compartilhar</span>
        </button>
      </div>

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
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1"
            style={{ background: 'rgba(0,122,255,0.15)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}
      </div>

      {/* Info table */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--bg-border)' }}>
        {[
          { label: 'Servidor', value: fmtDateTime(pos?.serverTime) },
          { label: 'GPS Fix', value: fmtDateTime(pos?.fixTime) },
          { label: `Fonte · ${powerSource}`, value: voltageStr, valueColor: voltage ? (voltage > 11 ? '#34C759' : '#FF9500') : undefined },
          { label: 'Ignição', value: ignition === true ? 'Ligada' : ignition === false ? `Desligada ${fmtDuration(statusSince)}` : '—', valueColor: ignition === true ? '#34C759' : ignition === false ? '#FF3B30' : undefined },
          { label: 'Odômetro', value: odometerKm },
          { label: 'Velocidade', value: `${speed} km/h`, valueColor: speed > 0 ? '#007AFF' : undefined },
        ].map((item, i) => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2"
            style={{ background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: i < 5 ? '1px solid var(--bg-border)' : 'none' }}>
            <span className="text-xs" style={{ color: 'var(--text-lo)' }}>{item.label}</span>
            <span className="text-xs font-semibold" style={{ color: item.valueColor || 'var(--text-mid)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {clientName && (
        <div className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2"
          style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)' }}>
          <span>👤</span>
          <p className="text-xs" style={{ color: 'var(--text-mid)' }}>Cliente: <span className="font-semibold" style={{ color: '#FF9500' }}>{clientName}</span></p>
        </div>
      )}

      {pos && <p className="text-xs text-center mt-1" style={{ color: 'var(--text-lo)' }}>{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}</p>}
    </div>
  );
}

/* ── DeviceListItem ── */
interface ListItemProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  isSelected: boolean;
  clientName: string;
  onSelect: () => void;
}

function DeviceListItem({ device, pos, isSelected, clientName, onSelect }: ListItemProps) {
  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const isOffline = status === 'offline' || status === 'expirado';
  const offlineTag = isOffline ? timeOffline(device.lastUpdate) : null;

  return (
    <button onClick={onSelect} className="w-full text-left px-4 py-3 transition-all"
      style={{ background: isSelected ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--bg-border)' }}>
      <div className="flex items-center gap-3">

        {/* Avatar column */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: '52px' }}>
          <div className="relative">
            <div className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: isSelected ? 'rgba(0,122,255,0.2)' : S_BG[status] }}>
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <path d="M10 30L12 22H36L38 30H10Z" fill={isSelected ? '#007AFF' : S_COLOR[status]}/>
                <path d="M12 22L14.5 14H33.5L36 22" fill={isSelected ? '#007AFF' : S_COLOR[status]} opacity="0.55"/>
                <circle cx="17" cy="32" r="3.5" fill={isSelected ? '#007AFF' : S_COLOR[status]}/>
                <circle cx="31" cy="32" r="3.5" fill={isSelected ? '#007AFF' : S_COLOR[status]}/>
              </svg>
            </div>
            {/* Signal dot */}
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full"
              style={{ background: S_COLOR[status], border: '2.5px solid var(--bg-page)' }} />
          </div>
          {offlineTag && (
            <span className="mt-1 font-semibold text-center px-1.5 py-0.5 rounded"
              style={{ background: S_BG[status], color: S_COLOR[status], fontSize: '9px', lineHeight: '1.2' }}>
              {offlineTag}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-hi)' }}>{device.name}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: clientName ? 'rgba(255,149,0,0.15)' : S_BG[status], color: clientName ? '#FF9500' : S_COLOR[status] }}>
              {clientName ? `👤 ${clientName}` : S_LABEL[status]}
            </span>
          </div>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-lo)' }}>{device.uniqueId.slice(-12)}</p>
          {speed > 0 && <p className="text-xs mt-0.5" style={{ color: '#007AFF' }}>⚡ {speed} km/h</p>}
        </div>

        {/* Three-dots */}
        <button onClick={e => { e.stopPropagation(); onSelect(); }}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center"
          style={{ background: 'transparent', opacity: 0.4 }}>
          <svg width="4" height="18" viewBox="0 0 4 18" fill="var(--text-lo)">
            <circle cx="2" cy="2" r="2"/><circle cx="2" cy="9" r="2"/><circle cx="2" cy="16" r="2"/>
          </svg>
        </button>
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
  const [filter, setFilter] = useState<'todos' | 'online' | 'offline' | 'expirando'>('todos');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState({ name: '', administrator: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [centerTrigger, setCenterTrigger] = useState(0);
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
    } catch { /**/ }
    finally { setLoading(false); }
  }, [asUser]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const countByStatus = {
    online: devices.filter(d => { const s = getStatus(d, posMap[d.id]); return s === 'movendo' || s === 'parado'; }).length,
    offline: devices.filter(d => getStatus(d, posMap[d.id]) === 'offline').length,
    expirando: devices.filter(d => getStatus(d, posMap[d.id]) === 'expirado').length,
  };

  const filteredDevices = devices.filter(d => {
    const st = getStatus(d, posMap[d.id]);
    if (filter === 'online' && st !== 'movendo' && st !== 'parado') return false;
    if (filter === 'offline' && st !== 'offline') return false;
    if (filter === 'expirando' && st !== 'expirado') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.uniqueId.includes(search)) return false;
    return true;
  });

  const filterTabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: devices.length },
    { key: 'online', label: 'Online', count: countByStatus.online },
    { key: 'offline', label: 'Offline', count: countByStatus.offline },
    { key: 'expirando', label: 'Expirando', count: countByStatus.expirando },
  ];

  function selectDevice(id: number) {
    setSelectedId(id);
    setMobileView('mapa');
  }

  function closeDetailMobile() {
    setSelectedId(null);
    setMobileView('lista');
  }

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
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>
              👤 {asUserName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}>
            {countByStatus.online} online
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(107,114,128,0.15)', color: '#6B7280' }}>
            {countByStatus.offline + countByStatus.expirando} offline
          </span>
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

      {/* ── Desktop nav tabs ── */}
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

      {/* ── Mobile toggle: Lista / Mapa ── */}
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

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden" style={{ position: 'relative', minHeight: 0 }}>

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col flex-none overflow-hidden"
          style={{ width: '280px', borderRight: '1px solid var(--bg-border)', background: 'var(--bg-page)' }}>
          <div className="flex-shrink-0 p-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {filterTabs.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="flex-1 text-xs py-1 rounded-lg font-medium transition-all"
                  style={{ background: filter === f.key ? '#007AFF' : 'var(--bg-input)', color: filter === f.key ? 'white' : 'var(--text-lo)', minWidth: '48px' }}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-12 px-6">
                <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p>
              </div>
            ) : filteredDevices.map(device => (
              <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                onSelect={() => setSelectedId(selectedId === device.id ? null : device.id)} />
            ))}
          </div>
        </div>

        {/* Map — zIndex:0 creates stacking context, trapping Leaflet internals (z 200-700)
            so the list overlay (z:10) and BottomNav (fixed z:50) appear correctly above */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, zIndex: 0 }}>
          <VehicleMap
            devices={devices} positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={(id) => selectDevice(id)}
            visible={mobileView === 'mapa'}
            centerTrigger={centerTrigger}
          />

          {/* Mobile bottom panel — absolute inside map container, shown only in mapa view */}
          {selectedId && selectedDevice && mobileView === 'mapa' && (
            <div className="md:hidden" style={{
              position: 'absolute', bottom: '64px', left: 0, right: 0,
              zIndex: 20,
              background: 'var(--bg-card)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '55%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
            }}>
              <DeviceDetail
                device={selectedDevice} pos={posMap[selectedId]}
                onClose={closeDetailMobile}
                onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
                onCenter={() => setCenterTrigger(t => t + 1)}
                clientName={assignments[selectedId]} isAdmin={user.administrator}
                variant="sheet"
              />
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        {selectedId && selectedDevice && (
          <div className="hidden md:flex flex-col flex-none overflow-hidden"
            style={{ width: '360px', borderLeft: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
            <DeviceDetail device={selectedDevice} pos={posMap[selectedId]}
              onClose={() => setSelectedId(null)}
              onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
              onCenter={() => setCenterTrigger(t => t + 1)}
              clientName={assignments[selectedId]} isAdmin={user.administrator} variant="panel" />
          </div>
        )}

        {/* Mobile list overlay — sits over map in lista view */}
        <div className="md:hidden" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 10,
          background: 'var(--bg-page)',
          display: mobileView === 'lista' ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search & filters */}
          <div className="flex-shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {filterTabs.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ background: filter === f.key ? '#007AFF' : 'var(--bg-input)', color: filter === f.key ? 'white' : 'var(--text-lo)', whiteSpace: 'nowrap' }}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p>
              </div>
            ) : filteredDevices.map(device => (
              <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                onSelect={() => selectDevice(device.id)} />
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
