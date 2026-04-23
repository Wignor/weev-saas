'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const HistoricoMap = dynamic(() => import('@/components/HistoricoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-surface">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

function getUserFromCookie(): { name: string } {
  if (typeof document === 'undefined') return { name: '' };
  try {
    const raw = document.cookie
      .split('; ')
      .find((row) => row.startsWith('wt_user='))
      ?.split('=').slice(1).join('=');
    if (!raw) return { name: '' };
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return { name: '' };
  }
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return {
    from: start.toISOString().slice(0, 16),
    to: now.toISOString().slice(0, 16),
  };
}

export default function HistoricoPage() {
  const pathname = usePathname();
  const [user, setUser] = useState({ name: '' });
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const range = todayRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [route, setRoute] = useState<TraccarPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setUser(getUserFromCookie());
    fetch('/api/devices')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDevices(data);
          if (data.length > 0) setSelectedDevice(String(data[0].id));
        }
      })
      .catch(() => null);
  }, []);

  async function handleSearch() {
    if (!selectedDevice) return;
    setLoading(true);
    setSearched(true);
    try {
      const fromISO = new Date(from).toISOString();
      const toISO = new Date(to).toISOString();
      const res = await fetch(
        `/api/reports/trips?deviceId=${selectedDevice}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
      );
      const data = await res.json();
      setRoute(Array.isArray(data) ? data : []);
    } catch {
      setRoute([]);
    } finally {
      setLoading(false);
    }
  }

  const maxSpeed = route.length ? Math.max(...route.map((p) => knotsToKmh(p.speed))) : 0;
  const totalPoints = route.length;
  const distanceKm = route.length > 1
    ? (route[route.length - 1].attributes?.totalDistance as number ?? 0) / 1000
    : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar userName={user.name} currentPath={pathname} />

      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo */}
        <aside className="w-72 bg-white border-r border-border flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-dark text-sm">Histórico de Percursos</h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Dispositivo */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Dispositivo</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Data início */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Data/hora início</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Data fim */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Data/hora fim</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={loading || !selectedDevice}
              className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar Percurso'}
            </button>

            {/* Estatísticas */}
            {searched && !loading && (
              <div className="bg-surface rounded-xl p-3 space-y-2 mt-2">
                <p className="text-xs font-semibold text-dark mb-2">Resumo</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Pontos registrados</span>
                  <span className="font-medium text-dark">{totalPoints}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Velocidade máx.</span>
                  <span className="font-medium text-dark">{maxSpeed} km/h</span>
                </div>
                {distanceKm > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Distância total</span>
                    <span className="font-medium text-dark">{distanceKm.toFixed(1)} km</span>
                  </div>
                )}
                {totalPoints === 0 && (
                  <p className="text-xs text-muted text-center py-1">Nenhum registro encontrado</p>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Mapa */}
        <HistoricoMap route={route} />
      </div>
    </div>
  );
}
