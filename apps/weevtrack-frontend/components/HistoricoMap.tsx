'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { TraccarPosition, knotsToKmh } from '@/lib/traccar';

export interface Stop {
  lat: number;
  lon: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

interface HistoricoMapProps {
  route: TraccarPosition[];
  stops?: Stop[];
}

function fmtStopDur(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

export default function HistoricoMap({ route, stops = [] }: HistoricoMapProps) {
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

    layersRef.current.forEach((layer) => map.removeLayer(layer as Parameters<typeof map.removeLayer>[0]));
    layersRef.current = [];

    if (route.length === 0) return;

    const validPoints = route.filter((p) => p.valid && (p.latitude !== 0 || p.longitude !== 0));
    if (validPoints.length === 0) return;

    const latlngs = validPoints.map((p) => [p.latitude, p.longitude] as [number, number]);

    // Route line
    const polyline = L.polyline(latlngs, { color: '#007AFF', weight: 4, opacity: 0.85 }).addTo(map);
    layersRef.current.push(polyline);

    // Start marker
    const startIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#34C759;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const start = L.marker(latlngs[0], { icon: startIcon })
      .addTo(map)
      .bindPopup(`<b>Início</b><br>${new Date(validPoints[0].fixTime).toLocaleString('pt-BR')}`);
    layersRef.current.push(start);

    // End marker
    const endIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#FF3B30;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const last = validPoints[validPoints.length - 1];
    const end = L.marker(latlngs[latlngs.length - 1], { icon: endIcon })
      .addTo(map)
      .bindPopup(`<b>Fim</b><br>${new Date(last.fixTime).toLocaleString('pt-BR')}<br>${knotsToKmh(last.speed)} km/h`);
    layersRef.current.push(end);

    // Stop markers
    stops.forEach((stop, i) => {
      const stopIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#FF9500;border:2.5px solid white;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.35);font-size:11px;font-weight:800;color:white;font-family:sans-serif">P</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const stopMarker = L.marker([stop.lat, stop.lon], { icon: stopIcon })
        .addTo(map)
        .bindPopup(
          `<b>Parada ${i + 1}</b><br>` +
          `⏱ Duração: <b>${fmtStopDur(stop.durationSeconds)}</b><br>` +
          `De: ${new Date(stop.startTime).toLocaleString('pt-BR')}<br>` +
          `Até: ${new Date(stop.endTime).toLocaleString('pt-BR')}`
        );
      layersRef.current.push(stopMarker);
    });

    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }, [route, stops]);

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
    </div>
  );
}
