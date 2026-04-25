'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import DesktopNav from '@/components/DesktopNav';

interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  attributes: Record<string, unknown>;
}

interface TraccarDevice {
  id: number;
  name: string;
}

const eventConfig: Record<string, { icon: string; label: string; color: string }> = {
  deviceOnline:    { icon: '🟢', label: 'Dispositivo online',    color: '#34C759' },
  deviceOffline:   { icon: '🔴', label: 'Dispositivo offline',   color: '#FF3B30' },
  deviceMoving:    { icon: '🚗', label: 'Veículo em movimento',  color: '#007AFF' },
  deviceStopped:   { icon: '🛑', label: 'Veículo parou',         color: '#FF9500' },
  ignitionOn:      { icon: '🔑', label: 'Motor ligado',          color: '#34C759' },
  ignitionOff:     { icon: '🔒', label: 'Motor desligado',       color: '#FF3B30' },
  deviceOverspeed: { icon: '🚦', label: 'Excesso de velocidade', color: '#FF3B30' },
  lowBattery:      { icon: '🔋', label: 'Bateria fraca',         color: '#FF9500' },
  powerCut:        { icon: '⚡', label: 'Energia cortada',       color: '#FF3B30' },
  powerRestored:   { icon: '⚡', label: 'Energia restaurada',    color: '#34C759' },
  geofenceEnter:   { icon: '📍', label: 'Entrou na cerca',       color: '#007AFF' },
  geofenceExit:    { icon: '📍', label: 'Saiu da cerca',         color: '#FF9500' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

export default function AlertasPage() {
  const [events, setEvents] = useState<TraccarEvent[]>([]);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    Promise.all([fetch('/api/events').then((r) => r.json()), fetch('/api/devices').then((r) => r.json())])
      .then(([evts, devs]) => {
        if (Array.isArray(evts)) setEvents(evts.slice(0, 100));
        if (Array.isArray(devs)) setDevices(devs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]));

  const filters = [
    { key: 'todos',    label: 'Todos' },
    { key: 'ignition', label: '🔑 Ignição' },
    { key: 'speed',    label: '🚦 Velocidade' },
    { key: 'device',   label: '📡 Conexão' },
    { key: 'battery',  label: '🔋 Bateria' },
  ];

  const filtered = events.filter((e) => {
    if (filter === 'todos')    return true;
    if (filter === 'ignition') return e.type.includes('ignition') || e.type.includes('Ignition');
    if (filter === 'speed')    return e.type.includes('speed')    || e.type.includes('Speed');
    if (filter === 'device')   return e.type.includes('device')   || e.type.includes('Device');
    if (filter === 'battery')  return e.type.includes('battery')  || e.type.includes('Battery') || e.type.includes('power');
    return true;
  });

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <h1 className="font-bold t-text-hi">Alertas</h1>
        {events.length > 0 && (
          <span className="text-xs badge-online px-2 py-0.5 rounded-full">{events.length}</span>
        )}
        <button onClick={toggleTheme} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-border)' }} title="Alternar tema">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </header>

      <DesktopNav />

      {/* Filtros */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-2 overflow-x-auto"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{
              background: filter === f.key ? '#007AFF' : 'var(--bg-input)',
              color: filter === f.key ? 'white' : 'var(--text-lo)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
            <div className="text-4xl mb-4">🔔</div>
            <p className="t-text-lo text-sm">Nenhum alerta encontrado</p>
            <p className="t-text-lo text-xs mt-1">Os alertas aparecerão aqui quando ocorrerem</p>
          </div>
        ) : (
          filtered.map((event) => {
            const cfg = eventConfig[event.type] || { icon: '📡', label: event.type, color: '#6B7280' };
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--bg-border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: `${cfg.color}18` }}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium t-text-hi">{cfg.label}</p>
                  <p className="text-xs t-text-lo mt-0.5">{deviceMap[event.deviceId] || `Dispositivo ${event.deviceId}`}</p>
                </div>
                <span className="text-xs t-text-lo flex-shrink-0">{timeAgo(event.eventTime)}</span>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
