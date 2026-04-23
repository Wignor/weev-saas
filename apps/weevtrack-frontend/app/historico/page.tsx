'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const HistoricoMap = dynamic(() => import('@/components/HistoricoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#12131A' }}>
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

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#12131A' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <h1 className="font-bold text-app-text">Histórico de Trajetos</h1>
      </header>

      {/* Filtros */}
      <div className="flex-shrink-0 p-4 space-y-3" style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        <div>
          <label className="block text-xs text-app-muted mb-1">Veículo</label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E' }}
          >
            {devices.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-app-muted mb-1">De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E', colorScheme: 'dark' }}
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !selectedDevice}
          className="w-full bg-primary text-white text-sm font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
        >
          {loading ? 'Buscando...' : 'Buscar Trajeto'}
        </button>
      </div>

      {/* Resultado */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {searched && !loading && route.length > 0 && (
          <div className="flex-shrink-0 grid grid-cols-3 gap-3 p-4" style={{ borderBottom: '1px solid #2A2D3E' }}>
            {[
              { label: 'Pontos', value: String(route.length), icon: '📍' },
              { label: 'Vel. máx.', value: `${maxSpeed} km/h`, icon: '⚡' },
              { label: 'Distância', value: distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '—', icon: '🛣️' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: '#1E2030' }}>
                <p className="text-lg">{stat.icon}</p>
                <p className="text-sm font-bold text-app-text mt-1">{stat.value}</p>
                <p className="text-xs text-app-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {showMap && route.length > 0 ? (
          <HistoricoMap route={route} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pb-20">
            {searched && !loading && route.length === 0 ? (
              <>
                <div className="text-4xl mb-4">🛣️</div>
                <p className="text-app-muted text-sm">Nenhum trajeto encontrado</p>
                <p className="text-app-muted text-xs mt-1">Tente um período diferente</p>
              </>
            ) : !searched ? (
              <>
                <div className="text-4xl mb-4">🗺️</div>
                <p className="text-app-muted text-sm">Selecione o veículo e o período</p>
                <p className="text-app-muted text-xs mt-1">O trajeto será exibido no mapa</p>
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
    <Suspense fallback={<div style={{ background: '#12131A', height: '100dvh' }} />}>
      <HistoricoContent />
    </Suspense>
  );
}
