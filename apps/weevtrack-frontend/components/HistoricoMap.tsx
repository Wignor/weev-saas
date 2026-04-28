'use client';

import { useState, useEffect, useRef } from 'react';
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
  addresses?: (string | null)[];
}

function fmtStopDur(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

type MapLayerType = 'normal' | 'hibrido' | 'satelite' | 'terreno';

const MAP_TYPE_OPTIONS = [
  { key: 'normal' as MapLayerType,   label: 'Normal',   imgUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/7/46/69.png',                                                                                           fallback: '#e2e8f0' },
  { key: 'hibrido' as MapLayerType,  label: 'Híbrido',  imgUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/69/46',                                                                  fallback: '#1a3320' },
  { key: 'satelite' as MapLayerType, label: 'Satélite', imgUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/69/46',                                                                  fallback: '#0d1f0d' },
  { key: 'terreno' as MapLayerType,  label: 'Terreno',  imgUrl: 'https://tile.opentopomap.org/7/46/69.png',                                                                                                                   fallback: '#9b8155' },
];

export default function HistoricoMap({ route, stops = [], addresses = [] }: HistoricoMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<unknown[]>([]);
  const tileLayerRef = useRef<unknown>(null);
  const labelsLayerRef = useRef<unknown>(null);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('hibrido');
  const [showMapPanel, setShowMapPanel] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;
    const L = require('leaflet');
    const map = L.map(containerRef.current, { center: [-15.7801, -47.9292], zoom: 5 });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      labelsLayerRef.current = null;
    };
  }, []);

  // Tile layer switcher
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = mapRef.current as LeafletMap;
    if (tileLayerRef.current) {
      try { map.removeLayer(tileLayerRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
    }
    if (labelsLayerRef.current) {
      try { map.removeLayer(labelsLayerRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
      labelsLayerRef.current = null;
    }
    if (mapLayer === 'normal') {
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', maxZoom: 20, maxNativeZoom: 19, subdomains: 'abcd',
      }).addTo(map);
    } else if (mapLayer === 'hibrido') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri', maxZoom: 20, maxNativeZoom: 19,
      }).addTo(map);
      labelsLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '', maxZoom: 20, maxNativeZoom: 19,
      }).addTo(map);
    } else if (mapLayer === 'satelite') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri', maxZoom: 20, maxNativeZoom: 19,
      }).addTo(map);
    } else if (mapLayer === 'terreno') {
      tileLayerRef.current = L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap', maxZoom: 17, maxNativeZoom: 17,
      }).addTo(map);
    }
  }, [mapLayer]);

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

    const polyline = L.polyline(latlngs, { color: '#007AFF', weight: 4, opacity: 0.85 }).addTo(map);
    layersRef.current.push(polyline);

    const startIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#34C759;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const start = L.marker(latlngs[0], { icon: startIcon })
      .addTo(map)
      .bindPopup(`<b>Início</b><br>${new Date(validPoints[0].fixTime).toLocaleString('pt-BR')}`);
    layersRef.current.push(start);

    const endIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#FF3B30;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const last = validPoints[validPoints.length - 1];
    const end = L.marker(latlngs[latlngs.length - 1], { icon: endIcon })
      .addTo(map)
      .bindPopup(`<b>Fim</b><br>${new Date(last.fixTime).toLocaleString('pt-BR')}<br>${knotsToKmh(last.speed)} km/h`);
    layersRef.current.push(end);

    stops.forEach((stop, i) => {
      const stopIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#FF9500;border:2.5px solid white;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.35);font-size:11px;font-weight:800;color:white;font-family:sans-serif">${i + 1}</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const address = addresses[i];
      const addrLine = address ? `<br>📍 ${address}` : '';
      const stopMarker = L.marker([stop.lat, stop.lon], { icon: stopIcon })
        .addTo(map)
        .bindPopup(
          `<b>Parada ${i + 1}</b>${addrLine}<br>` +
          `⏱ <b>${fmtStopDur(stop.durationSeconds)}</b><br>` +
          `De: ${new Date(stop.startTime).toLocaleString('pt-BR')}<br>` +
          `Até: ${new Date(stop.endTime).toLocaleString('pt-BR')}`
        );
      layersRef.current.push(stopMarker);
    });

    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }, [route, stops, addresses]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Map type button */}
      <button
        onClick={() => setShowMapPanel(p => !p)}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 800,
          background: 'white', border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '8px', padding: '5px 10px',
          fontSize: '12px', fontWeight: '600', cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '5px', color: '#333',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        Mapa
      </button>

      {/* Map type panel */}
      {showMapPanel && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 799 }}
            onClick={() => setShowMapPanel(false)} />
          <div style={{
            position: 'absolute', top: 46, right: 10, zIndex: 800,
            background: 'white', borderRadius: '14px', padding: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', width: '256px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Tipo de Mapa
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {MAP_TYPE_OPTIONS.map(cfg => (
                <button
                  key={cfg.key}
                  onClick={() => { setMapLayer(cfg.key); setShowMapPanel(false); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '6px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${mapLayer === cfg.key ? '#007AFF' : '#e5e7eb'}`,
                    background: mapLayer === cfg.key ? 'rgba(0,122,255,0.07)' : 'white',
                  }}
                >
                  <div style={{ width: '96px', height: '64px', borderRadius: '6px', overflow: 'hidden', background: cfg.fallback, position: 'relative' }}>
                    <img src={cfg.imgUrl} alt={cfg.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {cfg.key === 'hibrido' && (
                      <img src="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/7/69/46"
                        alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: mapLayer === cfg.key ? 700 : 600, color: mapLayer === cfg.key ? '#007AFF' : '#555' }}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
