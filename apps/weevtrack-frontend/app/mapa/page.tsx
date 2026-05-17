'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useNavWidth } from '@/hooks/useNavWidth';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const VehicleMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type DevicePref = { vehicleType: string };

function getVehiclePrefs(): Promise<Record<number, DevicePref>> {
  return fetch('/api/devices/prefs')
    .then(r => r.json())
    .then((data: Record<string, DevicePref>) => {
      const mapped: Record<number, DevicePref> = {};
      for (const [k, v] of Object.entries(data)) mapped[Number(k)] = v;
      return mapped;
    })
    .catch(() => ({}));
}

export default function MapaPage() {
  const navWidth = useNavWidth();
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [vehiclePrefs, setVehiclePrefs] = useState<Record<number, DevicePref>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [devRes, posRes] = await Promise.all([fetch('/api/devices'), fetch('/api/positions')]);
      if (devRes.status === 401) { window.location.href = '/login'; return; }
      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) setPositions(posData);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    getVehiclePrefs().then(setVehiclePrefs);
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const posMap = new Map(positions.map(p => [p.deviceId, p]));

  const online   = devices.filter(d => d.status === 'online').length;
  const moving   = devices.filter(d => {
    const p = posMap.get(d.id);
    return d.status === 'online' && p && knotsToKmh(p.speed) > 2;
  }).length;
  const offline  = devices.filter(d => d.status !== 'online').length;

  const vehiclePrefsForMap: Record<number, string> = {};
  for (const [id, pref] of Object.entries(vehiclePrefs)) {
    vehiclePrefsForMap[Number(id)] = pref.vehicleType;
  }

  return (
    <div
      className="hidden md:flex flex-col"
      style={{ height: '100dvh', background: 'var(--bg-page)', paddingLeft: navWidth }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span className="font-bold text-sm" style={{ color: 'var(--text-hi)' }}>Mapa — Todos os veículos</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759' }}>
            {moving > 0 ? `${moving} movendo` : `${online} online`}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(107,114,128,0.12)', color: '#6B7280' }}>
            {offline} offline
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-lo)' }}>
            {devices.length} veículos
          </span>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <VehicleMap
            devices={devices}
            positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={id => setSelectedId(prev => prev === id ? null : id)}
            visible={true}
            vehiclePrefs={vehiclePrefsForMap}
          />
        )}
      </div>
    </div>
  );
}
