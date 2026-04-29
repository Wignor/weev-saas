'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import DesktopNav from '@/components/DesktopNav';

interface AlertEntry {
  id: number;
  deviceId: number;
  deviceName: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
}

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

const alertConfig: Record<string, { icon: string; color: string }> = {
  ignitionOn:    { icon: '🔑', color: '#34C759' },
  ignitionOff:   { icon: '🔒', color: '#FF3B30' },
  moving:        { icon: '🚗', color: '#007AFF' },
  overspeed:     { icon: '🚦', color: '#FF3B30' },
  parking:       { icon: '🅿️', color: '#FF9500' },
  lowBattery:    { icon: '🔋', color: '#FF9500' },
  sos:           { icon: '🆘', color: '#FF3B30' },
  collision:     { icon: '💥', color: '#FF3B30' },
  geofenceExit:  { icon: '🚧', color: '#FF9500' },
  geofenceEnter: { icon: '📍', color: '#007AFF' },
};

const traccarConfig: Record<string, { icon: string; label: string; color: string }> = {
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

function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

export default function AlertasPage() {
  const [tab, setTab] = useState<'sistema' | 'traccar'>('sistema');
  const [date, setDate] = useState(todayStr());

  // Sistema alerts
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Traccar events
  const [events, setEvents] = useState<TraccarEvent[]>([]);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [traccarFilter, setTraccarFilter] = useState('todos');

  // Load sistema alerts when date changes
  useEffect(() => {
    setAlertsLoading(true);
    fetch(`/api/alerts/log?date=${date}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAlerts(data); })
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, [date]);

  // Load traccar events once
  useEffect(() => {
    if (tab !== 'traccar') return;
    setEventsLoading(true);
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch('/api/devices').then(r => r.json()),
    ])
      .then(([evts, devs]) => {
        if (Array.isArray(evts)) setEvents(evts.slice(0, 100));
        if (Array.isArray(devs)) setDevices(devs);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, [tab]);

  const deviceMap = Object.fromEntries(devices.map(d => [d.id, d.name]));

  const traccarFilters = [
    { key: 'todos',    label: 'Todos' },
    { key: 'ignition', label: '🔑 Ignição' },
    { key: 'speed',    label: '🚦 Velocidade' },
    { key: 'device',   label: '📡 Conexão' },
    { key: 'battery',  label: '🔋 Bateria' },
  ];

  const filteredEvents = events.filter(e => {
    if (traccarFilter === 'todos')    return true;
    if (traccarFilter === 'ignition') return e.type.includes('ignition') || e.type.includes('Ignition');
    if (traccarFilter === 'speed')    return e.type.includes('speed')    || e.type.includes('Speed');
    if (traccarFilter === 'device')   return e.type.includes('device')   || e.type.includes('Device');
    if (traccarFilter === 'battery')  return e.type.includes('battery')  || e.type.includes('Battery') || e.type.includes('power');
    return true;
  });

  return (
    <div className="flex flex-col sidebar-offset" style={{ height: '100dvh', background: 'var(--bg-page)' }}>

      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <h1 className="font-bold flex-1" style={{ color: 'var(--text-hi)' }}>Alertas</h1>
        <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-border)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </header>

      <DesktopNav />

      {/* Tabs */}
      <div className="flex-shrink-0 flex px-4 gap-2 py-2"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {([
          { key: 'sistema', label: '🔔 Sistema' },
          { key: 'traccar', label: '📡 Dispositivo' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: tab === t.key ? '#007AFF' : 'var(--bg-input)', color: tab === t.key ? 'white' : 'var(--text-lo)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sistema tab — date picker */}
      {tab === 'sistema' && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-lo)' }}>Data</span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
          />
          {alerts.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
              style={{ background: 'rgba(0,122,255,0.15)', color: '#007AFF' }}>
              {alerts.length} alertas
            </span>
          )}
        </div>
      )}

      {/* Traccar tab — filters */}
      {tab === 'traccar' && (
        <div className="flex-shrink-0 flex gap-2 px-4 py-2 overflow-x-auto"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', scrollbarWidth: 'none' }}>
          {traccarFilters.map(f => (
            <button key={f.key} onClick={() => setTraccarFilter(f.key)}
              className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
              style={{ background: traccarFilter === f.key ? '#007AFF' : 'var(--bg-input)', color: traccarFilter === f.key ? 'white' : 'var(--text-lo)' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">

        {/* Sistema alerts list */}
        {tab === 'sistema' && (
          alertsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
              <div className="text-4xl mb-4">🔔</div>
              <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum alerta em {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-lo)' }}>Os alertas aparecem aqui quando notificações são enviadas</p>
            </div>
          ) : (
            alerts.map(alert => {
              const cfg = alertConfig[alert.type] || { icon: '🔔', color: '#6B7280' };
              return (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: `${cfg.color}18` }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>{alert.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-mid)' }}>{alert.body}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-lo)' }}>{alert.deviceName}</p>
                  </div>
                  <span className="text-xs flex-shrink-0 font-mono mt-0.5" style={{ color: 'var(--text-lo)' }}>
                    {fmtTime(alert.timestamp)}
                  </span>
                </div>
              );
            })
          )
        )}

        {/* Traccar events list */}
        {tab === 'traccar' && (
          eventsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
              <div className="text-4xl mb-4">📡</div>
              <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum evento encontrado</p>
            </div>
          ) : (
            filteredEvents.map(event => {
              const cfg = traccarConfig[event.type] || { icon: '📡', label: event.type, color: '#6B7280' };
              return (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: `${cfg.color}18` }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>{cfg.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
                      {deviceMap[event.deviceId] || `Dispositivo ${event.deviceId}`}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-lo)' }}>
                    {fmtDateTime(event.eventTime)}
                  </span>
                </div>
              );
            })
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
}
