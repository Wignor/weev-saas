'use client';

import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

interface DeviceListProps {
  devices: TraccarDevice[];
  positions: TraccarPosition[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function getStatus(device: TraccarDevice, position?: TraccarPosition) {
  if (device.status === 'offline' || device.status === 'unknown') return 'offline';
  if (position && knotsToKmh(position.speed) > 2) return 'movendo';
  return 'parado';
}

const statusConfig = {
  movendo: { color: '#34C759', label: 'Movendo', dot: 'bg-success' },
  parado:  { color: '#FF9500', label: 'Parado',  dot: 'bg-warning' },
  offline: { color: '#808080', label: 'Offline', dot: 'bg-muted' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function DeviceList({ devices, positions, selectedId, onSelect }: DeviceListProps) {
  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));

  const online = devices.filter((d) => d.status === 'online').length;

  return (
    <aside className="w-72 bg-white border-r border-border flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-dark text-sm">Dispositivos</h2>
          <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
            {online}/{devices.length} online
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="1.5">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M5 11V7a7 7 0 0 1 14 0v4"/>
              </svg>
            </div>
            <p className="text-sm text-muted">Nenhum dispositivo cadastrado</p>
          </div>
        ) : (
          devices.map((device) => {
            const pos = posMap[device.id];
            const status = getStatus(device, pos);
            const cfg = statusConfig[status];
            const speed = pos ? knotsToKmh(pos.speed) : 0;
            const isSelected = selectedId === device.id;

            return (
              <button
                key={device.id}
                onClick={() => onSelect(device.id)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 transition-all hover:bg-surface ${
                  isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Ícone veículo */}
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary/10' : 'bg-surface'
                  }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#007AFF' : '#808080'} strokeWidth="1.8">
                      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                      <circle cx="7.5" cy="17.5" r="2.5"/>
                      <circle cx="17.5" cy="17.5" r="2.5"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-dark text-sm truncate">{device.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} style={{ backgroundColor: cfg.color }} />
                        <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      {status !== 'offline' && (
                        <span className="text-xs text-muted">
                          {speed > 2 ? `${speed} km/h` : 'Parado'}
                        </span>
                      )}
                      <span className="text-xs text-muted">
                        {device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
