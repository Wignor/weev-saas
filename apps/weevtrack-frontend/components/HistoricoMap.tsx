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

const MAP_TYPE_OPTIONS: { key: MapLayerType; label: string; lyrs: string; fallback: string }[] = [
  { key: 'normal',   label: 'Normal',   lyrs: 'm', fallback: '#e2e8f0' },
  { key: 'hibrido',  label: 'Híbrido',  lyrs: 'y', fallback: '#1a3320' },
  { key: 'satelite', label: 'Satélite', lyrs: 's', fallback: '#0d1f0d' },
  { key: 'terreno',  label: 'Terreno',  lyrs: 'p', fallback: '#7a6540' },
];

const MAX_FRAMES = 500;

function subsample(arr: TraccarPosition[]): TraccarPosition[] {
  if (arr.length <= MAX_FRAMES) return arr;
  const step = Math.ceil(arr.length / MAX_FRAMES);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

export default function HistoricoMap({ route, stops = [], addresses = [] }: HistoricoMapProps) {
  const mapRef        = useRef<LeafletMap | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const layersRef     = useRef<unknown[]>([]);
  const tileLayerRef  = useRef<unknown>(null);
  const labelsLayerRef = useRef<unknown>(null);
  const fittedRouteRef = useRef<string>('');
  const [mapLayer, setMapLayer]       = useState<MapLayerType>('hibrido');
  const [showMapPanel, setShowMapPanel] = useState(false);

  /* ── Player state ── */
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playSpeed, setPlaySpeed]   = useState(2);
  const [playerKey, setPlayerKey]   = useState(0);
  const framesRef       = useRef<TraccarPosition[]>([]);
  const playerMarkerRef = useRef<unknown | null>(null);
  const playedPolyRef   = useRef<unknown | null>(null);
  const remainPolyRef   = useRef<unknown | null>(null);
  const intervalRef     = useRef<NodeJS.Timeout | null>(null);

  /* ── Map init ── */
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

  /* ── Tile layer ── */
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
    const GOOGLE: Record<string, string> = {
      normal:   'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      hibrido:  'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      satelite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      terreno:  'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    };
    tileLayerRef.current = L.tileLayer(GOOGLE[mapLayer], {
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google Maps',
      maxZoom: 22, maxNativeZoom: 22,
    }).addTo(map);
  }, [mapLayer]);

  /* ── Compute frames on route change (also cleans up player layers) ── */
  useEffect(() => {
    if (mapRef.current && typeof window !== 'undefined') {
      const map = mapRef.current as LeafletMap;
      if (playerMarkerRef.current) {
        try { map.removeLayer(playerMarkerRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
        playerMarkerRef.current = null;
      }
      if (playedPolyRef.current) {
        try { map.removeLayer(playedPolyRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
        playedPolyRef.current = null;
      }
      if (remainPolyRef.current) {
        try { map.removeLayer(remainPolyRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
        remainPolyRef.current = null;
      }
    }
    const valid = route.filter(p => p.valid && (p.latitude !== 0 || p.longitude !== 0));
    framesRef.current = subsample(valid);
    setCurrentIdx(0);
    setIsPlaying(false);
    setPlayerKey(k => k + 1);
  }, [route]);

  /* ── Static route drawing (polyline + markers + stops) ── */
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = mapRef.current;

    layersRef.current.forEach(l => { try { map.removeLayer(l as Parameters<typeof map.removeLayer>[0]); } catch { /**/ } });
    layersRef.current = [];

    if (route.length === 0) return;
    const validPoints = route.filter(p => p.valid && (p.latitude !== 0 || p.longitude !== 0));
    if (validPoints.length === 0) return;

    const latlngs = validPoints.map(p => [p.latitude, p.longitude] as [number, number]);

    const polyline = L.polyline(latlngs, { color: '#007AFF', weight: 4, opacity: 0.85 }).addTo(map);
    layersRef.current.push(polyline);

    const startIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#34C759;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    layersRef.current.push(
      L.marker(latlngs[0], { icon: startIcon }).addTo(map)
        .bindPopup(`<b>Início</b><br>${new Date(validPoints[0].fixTime).toLocaleString('pt-BR')}`)
    );

    const endIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#FF3B30;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const last = validPoints[validPoints.length - 1];
    layersRef.current.push(
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map)
        .bindPopup(`<b>Fim</b><br>${new Date(last.fixTime).toLocaleString('pt-BR')}<br>${knotsToKmh(last.speed)} km/h`)
    );

    stops.forEach((stop, i) => {
      const stopIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#FF9500;border:2.5px solid white;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.35);font-size:11px;font-weight:800;color:white;font-family:sans-serif">${i + 1}</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const addrLine = addresses[i] ? `<br>📍 ${addresses[i]}` : '';
      layersRef.current.push(
        L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(map)
          .bindPopup(
            `<b>Parada ${i + 1}</b>${addrLine}<br>` +
            `⏱ <b>${fmtStopDur(stop.durationSeconds)}</b><br>` +
            `De: ${new Date(stop.startTime).toLocaleString('pt-BR')}<br>` +
            `Até: ${new Date(stop.endTime).toLocaleString('pt-BR')}`
          )
      );
    });

    const routeKey = `${route[0]?.deviceId}-${route.length}`;
    if (routeKey !== fittedRouteRef.current) {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      fittedRouteRef.current = routeKey;
    }
  }, [route, stops, addresses]);

  /* ── Animation interval ── */
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;
    const frames = framesRef.current;
    if (frames.length < 2) return;

    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        const next = prev + Math.max(1, Math.round(playSpeed));
        if (next >= frames.length - 1) {
          setIsPlaying(false);
          return frames.length - 1;
        }
        return next;
      });
    }, 80);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, playSpeed]);

  /* ── Update player marker + split polyline on currentIdx/playerKey change ── */
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = mapRef.current as LeafletMap;
    const frames = framesRef.current;
    if (frames.length === 0) return;

    const idx = Math.min(currentIdx, frames.length - 1);
    const pt  = frames[idx];
    if (!pt) return;

    const course = pt.course ?? 0;
    const iconHtml = `
      <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;transform:rotate(${course}deg)">
        <div style="width:26px;height:26px;background:#007AFF;border-radius:50%;border:3px solid white;
                    box-shadow:0 2px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="11" height="11" viewBox="0 0 10 10" fill="white">
            <polygon points="5,0.5 9.5,9 5,7 0.5,9"/>
          </svg>
        </div>
      </div>`;
    const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });

    type AnyMarker = { setLatLng: (ll: [number, number]) => void; setIcon: (i: unknown) => void };
    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([pt.latitude, pt.longitude], { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      (playerMarkerRef.current as AnyMarker).setLatLng([pt.latitude, pt.longitude]);
      (playerMarkerRef.current as AnyMarker).setIcon(icon);
    }

    /* Split polyline: played (solid) vs remaining (dashed) */
    if (playedPolyRef.current) {
      try { map.removeLayer(playedPolyRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
    }
    if (remainPolyRef.current) {
      try { map.removeLayer(remainPolyRef.current as Parameters<typeof map.removeLayer>[0]); } catch { /**/ }
    }
    const played = frames.slice(0, idx + 1).map(p => [p.latitude, p.longitude] as [number, number]);
    const remain = frames.slice(idx).map(p => [p.latitude, p.longitude] as [number, number]);
    if (played.length > 1) {
      playedPolyRef.current = L.polyline(played, { color: '#007AFF', weight: 4, opacity: 0.9 }).addTo(map);
    }
    if (remain.length > 1) {
      remainPolyRef.current = L.polyline(remain, { color: '#007AFF', weight: 3, opacity: 0.22, dashArray: '7,5' }).addTo(map);
    }

    if (isPlaying) {
      map.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.4 });
    }
  }, [currentIdx, playerKey, isPlaying]);

  /* ── Cleanup interval on unmount ── */
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  /* ── Derived values for player UI ── */
  const frames = framesRef.current;
  const total  = Math.max(frames.length - 1, 1);
  const pt     = frames[Math.min(currentIdx, frames.length - 1)];
  const currentTime = pt
    ? new Date(pt.fixTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })
    : '--:--:--';
  const currentSpeed = pt ? knotsToKmh(pt.speed) : 0;
  const pct = Math.round((currentIdx / total) * 100);
  const moving = currentSpeed > 2;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#e8e8e8' }} />

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
          <div style={{ position: 'fixed', inset: 0, zIndex: 799 }} onClick={() => setShowMapPanel(false)} />
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
                <button key={cfg.key}
                  onClick={() => { setMapLayer(cfg.key); setShowMapPanel(false); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '6px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${mapLayer === cfg.key ? '#007AFF' : '#e5e7eb'}`,
                    background: mapLayer === cfg.key ? 'rgba(0,122,255,0.07)' : 'white',
                  }}
                >
                  <div style={{ width: '96px', height: '64px', borderRadius: '6px', overflow: 'hidden', background: cfg.fallback }}>
                    <img src={`https://mt0.google.com/vt/lyrs=${cfg.lyrs}&x=94&y=145&z=8`} alt={cfg.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

      {/* ── Player bar ── */}
      {frames.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800,
          background: 'rgba(10,10,16,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          padding: '8px 14px 12px',
          display: 'flex', flexDirection: 'column', gap: '5px',
        }}>
          {/* Time + speed badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {currentTime}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700,
              color: moving ? '#30D158' : '#FF9F0A',
              background: moving ? 'rgba(48,209,88,0.12)' : 'rgba(255,159,10,0.12)',
              border: `1px solid ${moving ? 'rgba(48,209,88,0.3)' : 'rgba(255,159,10,0.3)'}`,
              borderRadius: '6px', padding: '2px 8px',
            }}>
              {currentSpeed} km/h
            </span>
          </div>

          {/* Scrubber */}
          <input
            type="range" min={0} max={total} value={currentIdx}
            onChange={e => { setIsPlaying(false); setCurrentIdx(Number(e.target.value)); }}
            style={{ width: '100%', accentColor: '#007AFF', cursor: 'pointer', margin: '1px 0' }}
          />

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Restart */}
            <button title="Reiniciar"
              onClick={() => { setIsPlaying(false); setCurrentIdx(0); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', opacity: 0.65, flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => {
                if (currentIdx >= frames.length - 1) setCurrentIdx(0);
                setIsPlaying(p => !p);
              }}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#007AFF', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 2px 8px rgba(0,122,255,0.45)',
              }}>
              {isPlaying
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
              }
            </button>

            {/* Progress % */}
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{pct}%</span>

            {/* Speed buttons */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              {([1, 2, 4, 8] as const).map(s => (
                <button key={s} onClick={() => setPlaySpeed(s)}
                  style={{
                    padding: '3px 7px', borderRadius: '6px',
                    fontSize: '11px', fontWeight: 700,
                    background: playSpeed === s ? '#007AFF' : 'rgba(255,255,255,0.1)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
