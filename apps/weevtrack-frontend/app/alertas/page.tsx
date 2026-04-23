'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';

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
  deviceOnline:       { icon: '🟢', label: 'Dispositivo online',    color: '#34C759' },
  deviceOffline:      { icon: '🔴', label: 'Dispositivo offline',   color: '#FF3B30' },
  deviceMoving:       { icon: '🚗', label: 'Veículo em movimento',  color: '#007AFF' },
  deviceStopped:      { icon: '🛑', label: 'Veículo parou',         color: '#FF9500' },
  ignitionOn:         { icon: '🔑', label: 'Motor ligado',          color: '#34C759' },
  ignitionOff:        { icon: '🔒', label: 'Motor desligado',       color: '#FF3B30' },
  deviceOverspeed:    { icon: '🚦', label: 'Excesso de velocidade', color: '#FF3B30' },
  lowBattery:         { icon: '🔋', label: 'Bateria fraca',         color: '#FF9500' },
  powerCut:           { icon: '⚡', label: 'Energia cortada',       color: '#FF3B30' },
  powerRestored:      { icon: '⚡', label: 'Energia restaurada',    color: '#34C759' },
  geofenceEnter:      { icon: '📍', label: 'Entrou na cerca',       color: '#007AFF' },
  geofenceExit:       { icon: '📍', label: 'Saiu da cerca',         color: '#FF9500' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    { key: 'todos', label: 'Todos' },
    { key: 'ignition', label: '🔑 Ignição' },
    { key: 'speed', label: '🚦 Velocidade' },
    { key: 'device', label: '📡 Conexão' },
    { key: 'battery', label: '🔋 Bateria' },
  ];

  const filtered = events.filter((e) => {
    if (filter === 'todos') return true;
    if (filter === 'ignition') return e.type.includes('ignition') || e.type.includes('Ignition');
    if (filter === 'speed') return e.type.includes('speed') || e.type.includes('Speed');
    if (filter === 'device') return e.type.includes('device') || e.type.includes('Device');
    if (filter === 'battery') return e.type.includes('battery') || e.type.includes('Battery') || e.type.includes('power');
    return true;
  });

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#12131A' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <h1 className="font-bold text-app-text">Alertas</h1>
        {events.length > 0 && (
          <span className="ml-auto text-xs badge-online px-2 py-0.5 rounded-full">{events.length}</span>
        )}
      </header>

      {/* Filtros */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-2 overflow-x-auto"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{
              background: filter === f.key ? '#007AFF' : '#2A2D3E',
              color: filter === f.key ? 'white' : '#6B7280',
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
            <p className="text-app-muted text-sm">Nenhum alerta encontrado</p>
            <p className="text-app-muted text-xs mt-1">Os alertas aparecerão aqui quando ocorrerem</p>
          </div>
        ) : (
          filtered.map((event) => {
            const cfg = eventConfig[event.type] || { icon: '📡', label: event.type, color: '#6B7280' };
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid #2A2D3E' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: `${cfg.color}18` }}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text">{cfg.label}</p>
                  <p className="text-xs text-app-muted mt-0.5">{deviceMap[event.deviceId] || `Dispositivo ${event.deviceId}`}</p>
                </div>
                <span className="text-xs text-app-muted flex-shrink-0">{timeAgo(event.eventTime)}</span>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
