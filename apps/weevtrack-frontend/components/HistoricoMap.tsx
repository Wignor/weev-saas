'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { TraccarPosition, knotsToKmh } from '@/lib/traccar';

interface HistoricoMapProps {
  route: TraccarPosition[];
}

export default function HistoricoMap({ route }: HistoricoMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;

    const L = require('leaflet');

    const map = L.map(containerRef.current, {
      center: [-15.7801, -47.9292],
      zoom: 5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    const L = require('leaflet');
    const map = mapRef.current;

    // Limpar camadas anteriores
    layersRef.current.forEach((layer) => map.removeLayer(layer as Parameters<typeof map.removeLayer>[0]));
    layersRef.current = [];

    if (route.length === 0) return;

    const validPoints = route.filter((p) => p.valid && (p.latitude !== 0 || p.longitude !== 0));
    if (validPoints.length === 0) return;

    const latlngs = validPoints.map((p) => [p.latitude, p.longitude] as [number, number]);

    // Linha do percurso
    const polyline = L.polyline(latlngs, {
      color: '#007AFF',
      weight: 4,
      opacity: 0.8,
    }).addTo(map);
    layersRef.current.push(polyline);

    // Marcador de início
    const startIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#34C759;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const start = L.marker(latlngs[0], { icon: startIcon })
      .addTo(map)
      .bindPopup(`<b>Início</b><br>${new Date(validPoints[0].fixTime).toLocaleString('pt-BR')}`);
    layersRef.current.push(start);

    // Marcador de fim
    const endIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#FF3B30;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const last = validPoints[validPoints.length - 1];
    const end = L.marker(latlngs[latlngs.length - 1], { icon: endIcon })
      .addTo(map)
      .bindPopup(`<b>Fim</b><br>${new Date(last.fixTime).toLocaleString('pt-BR')}<br>${knotsToKmh(last.speed)} km/h`);
    layersRef.current.push(end);

    // Ajustar zoom
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }, [route]);

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      {route.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 rounded-2xl shadow-sm border border-border px-8 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="1.5">
                <path d="M3 12h18M12 3l9 9-9 9"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-dark">Selecione um dispositivo e período</p>
            <p className="text-xs text-muted mt-1">O percurso aparecerá aqui</p>
          </div>
        </div>
      )}
    </div>
  );
}
