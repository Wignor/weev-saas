'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import DeviceList from '@/components/DeviceList';
import { TraccarDevice, TraccarPosition } from '@/lib/traccar';

const VehicleMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted">Carregando mapa...</p>
      </div>
    </div>
  ),
});

function getUserFromCookie(): { name: string; administrator: boolean } {
  if (typeof document === 'undefined') return { name: '', administrator: false };
  try {
    const raw = document.cookie
      .split('; ')
      .find((row) => row.startsWith('wt_user='))
      ?.split('=').slice(1).join('=');
    if (!raw) return { name: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return { name: '', administrator: false };
  }
}

export default function DashboardPage() {
  const pathname = usePathname();
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [user, setUser] = useState({ name: '', administrator: false });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUser(getUserFromCookie());
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, posRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/positions'),
      ]);

      if (devRes.status === 401) {
        window.location.href = '/login';
        return;
      }

      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);

      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) setPositions(posData);
      setLastUpdate(new Date());
    } catch {
      // silencioso — tenta novamente no próximo ciclo
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const onlineCount = devices.filter((d) => d.status === 'online').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar userName={user.name} currentPath={pathname} />

      {/* Barra de status */}
      <div className="bg-white border-b border-border px-4 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span><b className="text-dark">{onlineCount}</b> online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-border" />
            <span><b className="text-dark">{devices.length - onlineCount}</b> offline</span>
          </div>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      {/* Conteúdo principal */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted">Carregando dispositivos...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <DeviceList
            devices={devices}
            positions={positions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <VehicleMap
            devices={devices}
            positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={setSelectedId}
          />
        </div>
      )}
    </div>
  );
}
