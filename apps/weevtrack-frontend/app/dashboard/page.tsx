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
}

function DeviceDetail({ device, pos, onClose, onHistory, clientName, isAdmin }: DeviceDetailProps) {
  const [cmdLoading, setCmdLoading] = useState<string | null>(null);
  const [cmdMsg, setCmdMsg] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(device.name);
  const [deviceName, setDeviceName] = useState(device.name);
  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const ignition = pos?.attributes?.ignition;
  const battery = pos?.attributes?.batteryLevel as number | undefined;

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
    } catch {
      setCmdMsg('❌ Erro de conexão');
    } finally {
      setCmdLoading(null);
      setTimeout(() => setCmdMsg(''), 4000);
    }
  }

  async function doRename() {
    if (!renameVal.trim() || renameVal.trim() === deviceName) { setRenaming(false); return; }
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, name: renameVal.trim() }),
      });
      if (res.ok) {
        setDeviceName(renameVal.trim());
        setCmdMsg('✅ Renomeado com sucesso');
      } else {
        setCmdMsg('❌ Erro ao renomear');
      }
    } catch { setCmdMsg('❌ Erro de conexão'); }
    setRenaming(false);
    setTimeout(() => setCmdMsg(''), 3000);
  }

  function shareLocation() {
    if (!pos) return;
    const url = `https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`;
    if (navigator.share) {
      navigator.share({ title: device.name, text: `Localização de ${device.name}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setCmdMsg('✅ Link copiado!');
      setTimeout(() => setCmdMsg(''), 3000);
    }
  }

  const statusBadge: Record<string, string> = {
    movendo: 'badge-online',
    parado: 'badge-parado',
    offline: 'badge-offline',
  };
  const statusLabel: Record<string, string> = {
    movendo: 'Em movimento',
    parado: 'Estático',
    offline: 'Offline',
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div
        className="slide-up rounded-t-2xl p-5 pb-20"
        style={{ background: '#1E2030', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#2A2D3E' }} />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
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
                <button onClick={doRename}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(52,199,89,0.15)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <button onClick={() => setRenaming(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,59,48,0.1)' }}>
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
            <p className="text-xs text-app-muted mt-0.5">{device.uniqueId}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusBadge[status]}`}>
            {statusLabel[status]}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { icon: '🔑', label: 'Ignição', value: ignition === true ? 'Ligada' : ignition === false ? 'Desligada' : '—', color: ignition ? '#34C759' : '#FF3B30' },
            { icon: '⚡', label: 'Velocidade', value: `${speed} km/h`, color: speed > 0 ? '#007AFF' : '#6B7280' },
            { icon: '🕐', label: 'Atualizado', value: device.lastUpdate ? timeAgo(device.lastUpdate) + ' atrás' : '—', color: '#6B7280' },
            { icon: '🔋', label: 'Bateria', value: battery !== undefined ? `${battery}%` : 'Com fio', color: '#34C759' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: '#12131A' }}>
              <p className="text-xs text-app-muted mb-1">{item.icon} {item.label}</p>
              <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Endereço */}
        {pos?.address && (
          <div className="rounded-xl p-3 mb-4 flex gap-2" style={{ background: '#12131A' }}>
            <span className="text-sm mt-0.5">📍</span>
            <p className="text-xs text-app-muted leading-relaxed">{pos.address}</p>
          </div>
        )}

        {pos && (
          <p className="text-xs text-app-muted mb-4 text-center">
            {pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)} — {new Date(pos.fixTime).toLocaleString('pt-BR')}
          </p>
        )}

        {/* Feedback do comando */}
        {cmdMsg && (
          <p className="text-sm text-center mb-3 font-medium" style={{ color: cmdMsg.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
            {cmdMsg}
          </p>
        )}

        {/* Badge de cliente */}
        {clientName && (
          <div className="rounded-xl px-3 py-2 mb-4 flex items-center gap-2"
            style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}>
            <span className="text-sm">👤</span>
            <p className="text-xs text-app-muted">Atribuído ao cliente <span className="font-semibold" style={{ color: '#FF9500' }}>{clientName}</span></p>
          </div>
        )}

        {/* Ações */}
        <div className={`grid gap-3 ${!clientName || isAdmin ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {(!clientName || isAdmin) && (
            <button
              onClick={() => sendCommand('engineStop', 'Bloqueio')}
              disabled={!!cmdLoading}
              className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs font-medium" style={{ color: '#FF3B30' }}>
                {cmdLoading === 'engineStop' ? '...' : 'Bloquear'}
              </span>
            </button>
          )}

          {(!clientName || isAdmin) && (
            <button
              onClick={() => sendCommand('engineResume', 'Desbloqueio')}
              disabled={!!cmdLoading}
              className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all disabled:opacity-50"
              style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              <span className="text-xs font-medium" style={{ color: '#34C759' }}>
                {cmdLoading === 'engineResume' ? '...' : 'Desbloquear'}
              </span>
            </button>
          )}

          <button
            onClick={onHistory}
            className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all"
            style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#007AFF' }}>Trajetos</span>
          </button>
        </div>

        {/* Segunda linha de ações */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            onClick={shareLocation}
            disabled={!pos}
            className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all disabled:opacity-40"
            style={{ background: 'rgba(88,86,214,0.12)', border: '1px solid rgba(88,86,214,0.2)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#5856D6' }}>Compartilhar</span>
          </button>

          <button
            onClick={() => pos && window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
            disabled={!pos}
            className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 transition-all disabled:opacity-40"
            style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#34C759' }}>Ver no Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lista' | 'mapa'>('lista');
  const [user, setUser] = useState({ name: '', administrator: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRef<{ push: (p: string) => void } | null>(null);

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

  const isAssigned = (deviceId: number) => !!assignments[deviceId];
  const assignedTo = (deviceId: number) => assignments[deviceId] || '';

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#12131A' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14"
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
        </div>
      </header>

      {/* Toggle Lista / Mapa */}
      <div className="flex-shrink-0 flex px-4 py-2 gap-2" style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        {(['lista', 'mapa'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: view === v ? '#007AFF' : 'transparent',
              color: view === v ? 'white' : '#6B7280',
            }}
          >
            {v === 'lista' ? 'Lista' : 'Mapa'}
          </button>
        ))}
        {lastUpdate && (
          <span className="text-xs text-app-muted self-center ml-1">
            {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Push banner */}
      <PushNotificationSetup />

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-app-muted">Carregando...</p>
            </div>
          </div>
        ) : view === 'lista' ? (
          <div className="h-full overflow-y-auto pb-4">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#1E2030' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                  </svg>
                </div>
                <p className="text-app-muted text-sm">Nenhum dispositivo cadastrado</p>
              </div>
            ) : (
              devices.map((device) => {
                const pos = posMap[device.id];
                const status = getStatus(device, pos);
                const speed = pos ? knotsToKmh(pos.speed) : 0;
                const ignition = pos?.attributes?.ignition;
                const isSelected = selectedId === device.id;

                const assigned = isAssigned(device.id);
                const clientName = assignedTo(device.id);

                return (
                  <button
                    key={device.id}
                    onClick={() => setSelectedId(isSelected ? null : device.id)}
                    className="w-full text-left px-4 py-3 transition-all"
                    style={{
                      background: isSelected ? '#252840' : 'transparent',
                      borderBottom: '1px solid #2A2D3E',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Ícone */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isSelected ? 'rgba(0,122,255,0.2)' : '#1E2030' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke={isSelected ? '#007AFF' : assigned ? '#FF9500' : status === 'offline' ? '#6B7280' : status === 'movendo' ? '#34C759' : '#FF9500'}
                          strokeWidth="1.8" strokeLinecap="round">
                          <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                          <circle cx="7.5" cy="17.5" r="2.5"/>
                          <circle cx="17.5" cy="17.5" r="2.5"/>
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-app-text text-sm truncate">{device.name}</span>
                          {assigned ? (
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
                          <span>{device.uniqueId.slice(-8)}</span>
                          <span>🔑 {ignition ? 'ON' : 'OFF'}</span>
                          {speed > 0 && <span>⚡ {speed}km/h</span>}
                          <span>{device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}</span>
                        </div>
                        {pos?.address && (
                          <p className="text-xs text-app-muted mt-1 truncate opacity-70">📍 {pos.address}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <VehicleMap
            devices={devices}
            positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={(id) => { setSelectedId(id); }}
          />
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav />

      {/* Device detail sheet */}
      {selectedId && selectedDevice && (
        <DeviceDetail
          device={selectedDevice}
          pos={posMap[selectedId]}
          onClose={() => setSelectedId(null)}
          onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
          clientName={assignments[selectedId]}
          isAdmin={user.administrator}
        />
      )}
    </div>
  );
}
