'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import DesktopNav from '@/components/DesktopNav';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';
import type { Stop } from '@/components/HistoricoMap';

const HistoricoMap = dynamic(() => import('@/components/HistoricoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString().slice(0, 16), to: now.toISOString().slice(0, 16) };
}

function detectStops(positions: TraccarPosition[]): Stop[] {
  const stops: Stop[] = [];
  const MIN_STOP_SEC = 60;
  let stopStart: number | null = null;
  for (let i = 0; i < positions.length; i++) {
    const moving = knotsToKmh(positions[i].speed) >= 3;
    if (!moving) {
      if (stopStart === null) stopStart = i;
    } else {
      if (stopStart !== null) {
        const dur = (new Date(positions[i - 1].fixTime).getTime() - new Date(positions[stopStart].fixTime).getTime()) / 1000;
        if (dur >= MIN_STOP_SEC) stops.push({ lat: positions[stopStart].latitude, lon: positions[stopStart].longitude, startTime: positions[stopStart].fixTime, endTime: positions[i - 1].fixTime, durationSeconds: dur });
        stopStart = null;
      }
    }
  }
  if (stopStart !== null && positions.length > 0) {
    const dur = (new Date(positions[positions.length - 1].fixTime).getTime() - new Date(positions[stopStart].fixTime).getTime()) / 1000;
    if (dur >= MIN_STOP_SEC) stops.push({ lat: positions[stopStart].latitude, lon: positions[stopStart].longitude, startTime: positions[stopStart].fixTime, endTime: positions[positions.length - 1].fixTime, durationSeconds: dur });
  }
  return stops;
}

function fmtDur(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function minDate90() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 16);
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

function HistoricoContent() {
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const range = todayRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [route, setRoute] = useState<TraccarPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    fetch('/api/devices').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setDevices(data);
        const paramDevice = searchParams.get('device');
        setSelectedDevice(paramDevice || (data.length > 0 ? String(data[0].id) : ''));
      }
    }).catch(() => null);
  }, [searchParams]);

  function downloadCSV() {
    if (!route.length) return;
    const deviceName = devices.find(d => String(d.id) === selectedDevice)?.name || 'veiculo';
    const headers = ['Data/Hora', 'Latitude', 'Longitude', 'Velocidade (km/h)', 'Curso (°)', 'Ignição', 'Bateria (%)'];
    const rows = route.map(p => {
      const dt = new Date(p.fixTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return [
        dt,
        p.latitude.toFixed(6),
        p.longitude.toFixed(6),
        knotsToKmh(p.speed),
        Math.round(p.course),
        p.attributes?.ignition ? 'Ligado' : 'Desligado',
        p.attributes?.batteryLevel ?? '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trajeto-${deviceName}-${from.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSearch() {
    if (!selectedDevice) return;
    setLoading(true);
    setSearched(true);
    setShowMap(false);
    try {
      const res = await fetch(
        `/api/reports/trips?deviceId=${selectedDevice}&from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`
      );
      const data = await res.json();
      setRoute(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setShowMap(true);
    } catch { setRoute([]); }
    finally { setLoading(false); }
  }

  const maxSpeed = route.length ? Math.max(...route.map((p) => knotsToKmh(p.speed))) : 0;
  const distanceKm = route.length > 1 ? ((route[route.length - 1].attributes?.totalDistance as number ?? 0) / 1000) : 0;
  const stops = route.length ? detectStops(route) : [];
  const totalParkSec = stops.reduce((sum, s) => sum + s.durationSeconds, 0);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <h1 className="font-bold t-text-hi">Histórico de Trajetos</h1>
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
      <div className="flex-shrink-0 p-4 space-y-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div>
          <label className="block text-xs t-text-lo mb-1">Veículo</label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
          >
            {devices.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs t-text-lo mb-1">De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
              min={minDate90()}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
            />
          </div>
          <div>
            <label className="block text-xs t-text-lo mb-1">Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={loading || !selectedDevice}
            className="flex-1 bg-primary text-white text-sm font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
          >
            {loading ? 'Buscando...' : 'Buscar Trajeto'}
          </button>
          {route.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
              title="Baixar CSV"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Resultado */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {searched && !loading && route.length > 0 && (
          <div className="flex-shrink-0 grid grid-cols-4 gap-2 p-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            {[
              { label: 'Pontos', value: String(route.length), icon: '📍' },
              { label: 'Vel. máx.', value: `${maxSpeed} km/h`, icon: '⚡' },
              { label: 'Distância', value: distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '—', icon: '🛣️' },
              { label: 'Paradas', value: stops.length > 0 ? `${stops.length} · ${fmtDur(totalParkSec)}` : '0', icon: '🅿️' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                <p className="text-lg">{stat.icon}</p>
                <p className="text-sm font-bold t-text-hi mt-1">{stat.value}</p>
                <p className="text-xs t-text-lo">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {showMap && route.length > 0 ? (
          <HistoricoMap route={route} stops={stops} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pb-20">
            {searched && !loading && route.length === 0 ? (
              <>
                <div className="text-4xl mb-4">🛣️</div>
                <p className="t-text-lo text-sm">Nenhum trajeto encontrado</p>
                <p className="t-text-lo text-xs mt-1">Tente um período diferente</p>
              </>
            ) : !searched ? (
              <>
                <div className="text-4xl mb-4">🗺️</div>
                <p className="t-text-lo text-sm">Selecione o veículo e o período</p>
                <p className="t-text-lo text-xs mt-1">O trajeto será exibido no mapa</p>
              </>
            ) : null}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default function HistoricoPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg-page)', height: '100dvh' }} />}>
      <HistoricoContent />
    </Suspense>
  );
}
