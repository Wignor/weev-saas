'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import PushNotificationSetup from '@/components/PushNotificationSetup';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const VehicleMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#12131A' }}>
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

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function fmtDuration(dateStr: string): string {
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

  const statusColor: Record<string, string> = { movendo: '#34C759', parado: '#FF9500', offline: '#6B7280' };
  const statusBg: Record<string, string> = { movendo: 'rgba(52,199,89,0.15)', parado: 'rgba(255,149,0,0.15)', offline: 'rgba(107,114,128,0.15)' };
  const statusLabel: Record<string, string> = { movendo: 'Movendo', parado: 'Estático', offline: 'Offline' };

  async function sendCommand(type: string, label: string) {
    setCmdLoading(type);
    setCmdMsg('');
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, type }),
      });
      const data = await res.json();
      setCmdMsg(res.ok ? `✅ ${label} enviado` : `❌ ${data.error || 'Falha'}`);
    } catch { setCmdMsg('❌ Erro de conexão'); }
    finally { setCmdLoading(null); setTimeout(() => setCmdMsg(''), 4000); }
  }

  async function doRename() {
    if (!renameVal.trim() || renameVal.trim() === deviceName) { setRenaming(false); return; }
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, name: renameVal.trim() }),
      });
      if (res.ok) { setDeviceName(renameVal.trim()); setCmdMsg('✅ Renomeado'); }
      else { setCmdMsg('❌ Erro ao renomear'); }
    } catch { setCmdMsg('❌ Erro de conexão'); }
    setRenaming(false);
    setTimeout(() => setCmdMsg(''), 3000);
  }

  function shareLocation() {
    if (!pos) return;
    const url = `https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`;
    if (navigator.share) {
      navigator.share({ title: deviceName, text: `Localização de ${deviceName}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setCmdMsg('✅ Link copiado!');
      setTimeout(() => setCmdMsg(''), 3000);
    }
  }

  const statusSince = pos?.deviceTime || device.lastUpdate;
  const statusStr = `${statusLabel[status]}${statusSince ? ' ' + fmtDuration(statusSince) : ''} GPS`;

  const canControl = !clientName || isAdmin;

  const content = (
    <div className={variant === 'panel' ? 'p-4' : 'p-5'} style={{ paddingBottom: variant === 'sheet' ? '5rem' : '1rem' }}>
      {variant === 'sheet' && <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#2A2D3E' }} />}

      {/* Header: name + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
                className="flex-1 rounded-lg px-2 py-1 text-base font-bold focus:outline-none"
                style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #007AFF' }}
              />
              <button onClick={doRename} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,199,89,0.15)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button onClick={() => setRenaming(false)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,59,48,0.1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-app-text truncate">{deviceName}</h2>
              {isAdmin && (
                <button onClick={() => { setRenameVal(deviceName); setRenaming(true); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,122,255,0.1)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-xs font-mono mt-0.5" style={{ color: '#6B7280' }}>{device.uniqueId}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {variant === 'panel' && (
            <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center mb-1" style={{ background: 'rgba(107,114,128,0.15)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: statusBg[status], color: statusColor[status] }}>
            {statusStr}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {cmdMsg && (
        <p className="text-xs text-center mb-3 font-medium py-2 rounded-lg"
          style={{ background: cmdMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: cmdMsg.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
          {cmdMsg}
        </p>
      )}

      {/* Address */}
      {pos?.address ? (
        <div className="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2" style={{ background: '#12131A' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <p className="flex-1 text-xs leading-relaxed" style={{ color: '#C0C3D8' }}>{pos.address}</p>
          <button
            onClick={() => pos && window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1"
            style={{ background: 'rgba(0,122,255,0.15)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2" style={{ background: '#12131A' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <p className="text-xs" style={{ color: '#6B7280' }}>Endereço não disponível</p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { icon: '🕐', label: 'Servidor', value: fmtDateTime(pos?.serverTime) },
          { icon: '📡', label: 'GPS Fix', value: fmtDateTime(pos?.fixTime) },
          { icon: '🔌', label: 'Fonte', value: powerSource, color: voltage && voltage > 10 ? '#34C759' : '#6B7280' },
          { icon: '🔑', label: 'Ignição', value: ignition === true ? 'Ligada' : ignition === false ? 'Desligada' : '—', color: ignition === true ? '#34C759' : ignition === false ? '#FF3B30' : '#6B7280' },
          { icon: '⚡', label: 'Tensão', value: voltageStr, color: voltage && voltage > 11 ? '#34C759' : voltage ? '#FF9500' : '#6B7280' },
          { icon: '🏁', label: 'Odômetro', value: odometerKm },
          { icon: '🚀', label: 'Velocidade', value: `${speed} km/h`, color: speed > 0 ? '#007AFF' : '#6B7280' },
          { icon: '🔋', label: 'Bateria', value: battery !== undefined ? `${battery}%` : powerSource === 'Com fio' ? 'Com fio' : '—', color: battery !== undefined ? (battery > 20 ? '#34C759' : '#FF3B30') : '#6B7280' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl p-2.5" style={{ background: '#12131A' }}>
            <p className="text-xs mb-0.5" style={{ color: '#6B7280' }}>{item.icon} {item.label}</p>
            <p className="text-xs font-semibold leading-tight" style={{ color: item.color || '#C0C3D8' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Coords */}
      {pos && (
        <p className="text-xs text-center mb-3" style={{ color: '#4A4D5E' }}>
          {pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}
        </p>
      )}

      {/* Client badge */}
      {clientName && (
        <div className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)' }}>
          <span className="text-sm">👤</span>
          <p className="text-xs" style={{ color: '#C0C3D8' }}>Cliente: <span className="font-semibold" style={{ color: '#FF9500' }}>{clientName}</span></p>
        </div>
      )}

      {/* Action buttons - scrollable row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {canControl && (
          <button
            onClick={() => sendCommand('engineStop', 'Bloqueio')}
            disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-50 transition-all"
            style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)', minWidth: '64px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#FF3B30' }}>
              {cmdLoading === 'engineStop' ? '...' : 'Bloquear'}
            </span>
          </button>
        )}

        {canControl && (
          <button
            onClick={() => sendCommand('engineResume', 'Desbloqueio')}
            disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-50 transition-all"
            style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '64px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#34C759' }}>
              {cmdLoading === 'engineResume' ? '...' : 'Desbloquear'}
            </span>
          </button>
        )}

        <button
          onClick={onHistory}
          className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 transition-all"
          style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)', minWidth: '64px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#007AFF' }}>Trajetos</span>
        </button>

        <button
          onClick={shareLocation}
          disabled={!pos}
          className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-40 transition-all"
          style={{ background: 'rgba(88,86,214,0.12)', border: '1px solid rgba(88,86,214,0.2)', minWidth: '64px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#5856D6' }}>Compartilhar</span>
        </button>

        <button
          onClick={() => pos && window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
          disabled={!pos}
          className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-3 flex-shrink-0 disabled:opacity-40 transition-all"
          style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '64px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#34C759' }}>Google Maps</span>
        </button>
      </div>
    </div>
  );

  if (variant === 'panel') {
    return <div className="flex flex-col h-full overflow-y-auto">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div
        className="slide-up rounded-t-2xl"
        style={{ background: '#1E2030', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
    const u = getUserFromCookie();
    setUser(u);
    if (u.administrator) {
      fetch('/api/admin/assignments').then(r => r.json()).then(data => {
        if (data && typeof data === 'object') setAssignments(data);
      }).catch(() => {});
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, posRes] = await Promise.all([fetch('/api/devices'), fetch('/api/positions')]);
      if (devRes.status === 401) { window.location.href = '/login'; return; }
      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) setPositions(posData);
      setLastUpdate(new Date());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));
  const online = devices.filter((d) => d.status === 'online').length;
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const statusBadge: Record<string, string> = { movendo: 'badge-online', parado: 'badge-parado', offline: 'badge-offline' };
  const statusLabel: Record<string, string> = { movendo: 'Movendo', parado: 'Estático', offline: 'Offline' };

  const filteredDevices = devices.filter(d => {
    if (filter === 'online' && d.status !== 'online') return false;
    if (filter === 'offline' && d.status === 'online') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.uniqueId.includes(search)) return false;
    return true;
  });

  function DeviceListItem({ device }: { device: TraccarDevice }) {
    const pos = posMap[device.id];
    const status = getStatus(device, pos);
    const speed = pos ? knotsToKmh(pos.speed) : 0;
    const ignition = pos?.attributes?.ignition;
    const isSelected = selectedId === device.id;
    const clientName = assignments[device.id] || '';

    return (
      <button
        onClick={() => setSelectedId(isSelected ? null : device.id)}
        className="w-full text-left px-4 py-3 transition-all"
        style={{ background: isSelected ? '#252840' : 'transparent', borderBottom: '1px solid #2A2D3E' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isSelected ? 'rgba(0,122,255,0.2)' : '#1E2030' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={isSelected ? '#007AFF' : status === 'offline' ? '#6B7280' : status === 'movendo' ? '#34C759' : '#FF9500'}
              strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-app-text text-sm truncate">{device.name}</span>
              {clientName ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>
                  👤 {clientName}
                </span>
              ) : (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge[status]}`}>
                  {statusLabel[status]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-app-muted">
              <span className="font-mono">{device.uniqueId.slice(-8)}</span>
              <span>{ignition ? '🔑 ON' : '🔑 OFF'}</span>
              {speed > 0 && <span>⚡ {speed}km/h</span>}
              <span>{device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}</span>
            </div>
            {pos?.address && (
              <p className="text-xs text-app-muted mt-1 truncate opacity-60">📍 {pos.address}</p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#12131A' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-10"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" fill="white"/>
              <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-bold text-app-text text-base">WeevTrack</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs badge-online px-2 py-0.5 rounded-full font-medium">{online} online</span>
          <span className="text-xs badge-offline px-2 py-0.5 rounded-full font-medium">{devices.length - online} offline</span>
          {lastUpdate && (
            <span className="text-xs text-app-muted hidden md:block">
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* ── Mobile view toggle (hidden on desktop) ── */}
      <div className="md:hidden flex-shrink-0 flex px-4 py-2 gap-2"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        {(['lista', 'mapa'] as const).map((v) => (
          <button key={v}
            onClick={() => setMobileView(v)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: mobileView === v ? '#007AFF' : 'transparent', color: mobileView === v ? 'white' : '#6B7280' }}>
            {v === 'lista' ? 'Lista' : 'Mapa'}
          </button>
        ))}
        {lastUpdate && (
          <span className="text-xs text-app-muted self-center ml-1">
            {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Push banner ── */}
      <PushNotificationSetup />

      {/* ── Main content area ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Device list — sidebar on desktop, full on mobile ── */}
        <div
          className={`flex flex-col overflow-hidden flex-shrink-0
            ${mobileView === 'mapa' ? 'hidden' : 'flex-1'}
            md:flex md:flex-none md:w-72 lg:w-80`}
          style={{ borderRight: '1px solid #2A2D3E' }}
        >
          {/* Desktop search + filter (hidden on mobile) */}
          <div className="hidden md:block flex-shrink-0 p-3" style={{ borderBottom: '1px solid #2A2D3E' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar veículo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E' }}
              />
            </div>
            <div className="flex gap-1">
              {(['todos', 'online', 'offline'] as const).map(f => (
                <button key={f}
                  onClick={() => setFilter(f)}
                  className="flex-1 text-xs py-1 rounded-lg font-medium capitalize transition-all"
                  style={{ background: filter === f ? '#007AFF' : '#12131A', color: filter === f ? 'white' : '#6B7280' }}>
                  {f === 'todos' ? `Todos (${devices.length})` : f === 'online' ? `Online (${online})` : `Offline (${devices.length - online})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#1E2030' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                  </svg>
                </div>
                <p className="text-app-muted text-sm">{search ? 'Nenhum resultado' : 'Nenhum dispositivo'}</p>
              </div>
            ) : (
              filteredDevices.map(device => <DeviceListItem key={device.id} device={device} />)
            )}
          </div>
        </div>

        {/* ── Map area ── */}
        <div className={`relative flex-1 ${mobileView === 'lista' ? 'hidden' : 'flex'} md:flex`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ background: '#12131A' }}>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <VehicleMap
              devices={devices}
              positions={positions}
              selectedDeviceId={selectedId}
              onDeviceSelect={(id) => {
                setSelectedId(id);
                setMobileView('mapa');
              }}
            />
          )}
        </div>

        {/* ── Desktop detail panel (right sidebar) ── */}
        {selectedId && selectedDevice && (
          <div className="hidden md:flex flex-col flex-none overflow-hidden"
            style={{ width: '360px', borderLeft: '1px solid #2A2D3E', background: '#1E2030' }}>
            <DeviceDetail
              device={selectedDevice}
              pos={posMap[selectedId]}
              onClose={() => setSelectedId(null)}
              onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
              clientName={assignments[selectedId]}
              isAdmin={user.administrator}
              variant="panel"
            />
          </div>
        )}
      </div>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />

      {/* ── Mobile bottom sheet ── */}
      {selectedId && selectedDevice && (
        <div className="md:hidden">
          <DeviceDetail
            device={selectedDevice}
            pos={posMap[selectedId]}
            onClose={() => setSelectedId(null)}
            onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
            clientName={assignments[selectedId]}
            isAdmin={user.administrator}
            variant="sheet"
          />
        </div>
      )}
    </div>
  );
}
