'use client';

import { useState, useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

interface MapProps {
  devices: TraccarDevice[];
  positions: TraccarPosition[];
  selectedDeviceId: number | null;
  onDeviceSelect: (id: number) => void;
  visible?: boolean;
  centerTrigger?: number;
  vehiclePrefs?: Record<number, string>;
  liveTrail?: Map<number, [number, number][]>;
}

function getMarkerColor(device: TraccarDevice, position?: TraccarPosition): string {
  if (device.status === 'offline' || device.status === 'unknown') return '#6B7280';
  if (position && knotsToKmh(position.speed) > 2) return '#34C759';
  return '#007AFF';
}

function createVehicleIcon(color: string, isSelected: boolean, vehicleType = 'car', name = ''): string {
  const shadow = isSelected
    ? 'drop-shadow(0 0 8px rgba(0,122,255,0.85)) drop-shadow(0 3px 10px rgba(0,0,0,0.7))'
    : 'drop-shadow(0 3px 8px rgba(0,0,0,0.75))';
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label = safeName ? `<div style="margin-top:3px;background:rgba(0,0,0,0.75);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:5px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;text-align:center;pointer-events:none;letter-spacing:0.02em">${safeName}</div>` : '';

  const dk = 'rgba(0,0,0,0.32)';   // dark overlay for windshields
  const wh = 'rgba(0,0,0,0.55)';   // wheels
  const sel = isSelected ? `stroke="white" stroke-width="2"` : '';
  const sc = isSelected ? 1.25 : 1;

  let svgW: number, svgH: number, svgContent: string;

  switch (vehicleType) {
    case 'motorcycle':
      svgW = Math.round(18 * sc); svgH = Math.round(46 * sc);
      svgContent = `
        <ellipse cx="9" cy="9" rx="8" ry="7" fill="${color}" ${sel}/>
        <ellipse cx="9" cy="9" rx="4" ry="3.5" fill="${dk}"/>
        <rect x="6.5" y="15" width="5" height="16" rx="2.5" fill="${color}"/>
        <ellipse cx="9" cy="37" rx="8" ry="7" fill="${color}" ${sel}/>
        <ellipse cx="9" cy="37" rx="4" ry="3.5" fill="${dk}"/>
        <path d="M1 8 H17" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
      break;
    case 'truck':
      svgW = Math.round(30 * sc); svgH = Math.round(54 * sc);
      svgContent = `
        <rect x="0" y="5" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="24" y="5" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="0" y="27" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="24" y="27" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="0" y="40" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="24" y="40" width="6" height="11" rx="2.5" fill="${wh}"/>
        <rect x="6" y="2" width="18" height="17" rx="3.5" fill="${color}" ${sel}/>
        <rect x="8" y="4" width="14" height="11" rx="2" fill="${dk}"/>
        <rect x="6" y="22" width="18" height="32" rx="2.5" fill="${color}" ${sel}/>`;
      break;
    case 'bus':
      svgW = Math.round(26 * sc); svgH = Math.round(60 * sc);
      svgContent = `
        <rect x="0" y="8" width="5" height="13" rx="2.5" fill="${wh}"/>
        <rect x="21" y="8" width="5" height="13" rx="2.5" fill="${wh}"/>
        <rect x="0" y="40" width="5" height="13" rx="2.5" fill="${wh}"/>
        <rect x="21" y="40" width="5" height="13" rx="2.5" fill="${wh}"/>
        <rect x="5" y="1" width="16" height="58" rx="5" fill="${color}" ${sel}/>
        <rect x="7" y="6" width="5" height="5" rx="1.5" fill="${dk}"/>
        <rect x="14" y="6" width="5" height="5" rx="1.5" fill="${dk}"/>
        <rect x="7" y="15" width="5" height="5" rx="1.5" fill="${dk}"/>
        <rect x="14" y="15" width="5" height="5" rx="1.5" fill="${dk}"/>
        <rect x="7" y="24" width="5" height="5" rx="1.5" fill="${dk}"/>
        <rect x="14" y="24" width="5" height="5" rx="1.5" fill="${dk}"/>`;
      break;
    case 'pickup':
      svgW = Math.round(30 * sc); svgH = Math.round(52 * sc);
      svgContent = `
        <rect x="0" y="4" width="6" height="13" rx="2.5" fill="${wh}"/>
        <rect x="24" y="4" width="6" height="13" rx="2.5" fill="${wh}"/>
        <rect x="0" y="34" width="6" height="13" rx="2.5" fill="${wh}"/>
        <rect x="24" y="34" width="6" height="13" rx="2.5" fill="${wh}"/>
        <rect x="6" y="1" width="18" height="24" rx="3.5" fill="${color}" ${sel}/>
        <rect x="8" y="3" width="14" height="18" rx="2" fill="${dk}"/>
        <rect x="6" y="28" width="18" height="24" rx="2.5" fill="${color}" ${sel}/>`;
      break;
    case 'universal':
      svgW = Math.round(30 * sc); svgH = Math.round(42 * sc);
      svgContent = `
        <path d="M15 1C8.37 1 3 6.37 3 13C3 22.5 15 41 15 41C15 41 27 22.5 27 13C27 6.37 21.63 1 15 1Z" fill="${color}" stroke="white" stroke-width="1.8" ${sel}/>
        <circle cx="15" cy="13" r="5.5" fill="white" opacity="0.35"/>
        <circle cx="15" cy="13" r="2.8" fill="white" opacity="0.75"/>`;
      break;
    default: // car
      svgW = Math.round(30 * sc); svgH = Math.round(50 * sc);
      svgContent = `
        <rect x="0" y="10" width="6" height="12" rx="2.5" fill="${wh}"/>
        <rect x="24" y="10" width="6" height="12" rx="2.5" fill="${wh}"/>
        <rect x="0" y="30" width="6" height="12" rx="2.5" fill="${wh}"/>
        <rect x="24" y="30" width="6" height="12" rx="2.5" fill="${wh}"/>
        <path d="M6 10 Q6 7 15 6 Q24 7 24 10 L24.5 18 L24.5 36 L24 40 Q24 44 15 44.5 Q6 44 6 40 L5.5 36 L5.5 18 Z" fill="${color}" ${sel}/>
        <path d="M7.5 11 Q8 8.5 15 8 Q22 8.5 22.5 11 L23 17 L7 17 Z" fill="${dk}"/>
        <path d="M7.5 39 Q8 41.5 15 42 Q22 41.5 22.5 39 L23 34 L7 34 Z" fill="${dk}"/>`;
  }

  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${Math.round(svgW/sc)} ${Math.round(svgH/sc)}" fill="none" style="filter:${shadow}">
      ${svgContent}
    </svg>
    ${label}
  </div>`;
}

export default function VehicleMap({
  devices = [], positions = [], selectedDeviceId, onDeviceSelect,
  visible = true, centerTrigger = 0, vehiclePrefs = {}, liveTrail,
}: MapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<globalThis.Map<number, Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFittedRef = useRef(false);
  const tileLayerRef = useRef<unknown>(null);
  const labelsLayerRef = useRef<unknown>(null);
  const isDarkRef = useRef(false);
  const animationsRef = useRef<globalThis.Map<number, number>>(new globalThis.Map());
  const polylineRef = useRef<unknown | null>(null);
  type MapLayerType = 'normal' | 'hibrido' | 'satelite' | 'terreno';
  const [mapLayer, setMapLayer] = useState<MapLayerType>('normal');
  const [showMapPanel, setShowMapPanel] = useState(false);

  function animateMarker(
    marker: Marker, deviceId: number,
    fromLat: number, fromLng: number,
    toLat: number, toLng: number,
    duration: number,
  ) {
    const existing = animationsRef.current.get(deviceId);
    if (existing) cancelAnimationFrame(existing);
    const start = performance.now();
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      marker.setLatLng([fromLat + (toLat - fromLat) * ease, fromLng + (toLng - fromLng) * ease]);
      if (t < 1) animationsRef.current.set(deviceId, requestAnimationFrame(step));
      else animationsRef.current.delete(deviceId);
    }
    animationsRef.current.set(deviceId, requestAnimationFrame(step));
  }

  // Initialize map (no tile layer — added by tile effect below)
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;
    const L = require('leaflet');
    isDarkRef.current = document.documentElement.getAttribute('data-theme') !== 'light';
    const map = L.map(containerRef.current, { center: [-15.7801, -47.9292], zoom: 5, zoomControl: true });
    mapRef.current = map;
    setTimeout(() => { map.invalidateSize(); }, 200);
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current.clear();
      animationsRef.current.forEach(id => cancelAnimationFrame(id));
      animationsRef.current.clear();
      hasFittedRef.current = false;
    };
  }, []);

  // Tile layer switcher
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    if (tileLayerRef.current) {
      try { (mapRef.current as LeafletMap).removeLayer(tileLayerRef.current as Parameters<LeafletMap['removeLayer']>[0]); } catch { /**/ }
    }
    if (labelsLayerRef.current) {
      try { (mapRef.current as LeafletMap).removeLayer(labelsLayerRef.current as Parameters<LeafletMap['removeLayer']>[0]); } catch { /**/ }
      labelsLayerRef.current = null;
    }
    // Google Maps tiles: m=normal, y=híbrido, s=satélite, p=terreno
    const GOOGLE: Record<string, string> = {
      normal:   'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      hibrido:  'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      satelite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      terreno:  'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    };
    const map = mapRef.current as LeafletMap;
    tileLayerRef.current = L.tileLayer(GOOGLE[mapLayer], {
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google Maps',
      maxZoom: 22, maxNativeZoom: 22,
    }).addTo(map);
  }, [mapLayer]);

  // Recalculate size + auto-fit when map becomes visible (mobile toggle)
  useEffect(() => {
    if (!visible || !mapRef.current) return;
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
      if (!hasFittedRef.current) {
        const L = require('leaflet');
        const valid = positions.filter(p => p.valid && !(p.latitude === 0 && p.longitude === 0));
        if (valid.length === 1) {
          mapRef.current?.setView([valid[0].latitude, valid[0].longitude], 15);
          hasFittedRef.current = true;
        } else if (valid.length > 1) {
          const bounds = L.latLngBounds(valid.map(p => [p.latitude, p.longitude]));
          mapRef.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
          hasFittedRef.current = true;
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [visible, positions]);

  // Update markers + auto-fit on first load
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = mapRef.current;
    const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));

    devices.forEach((device) => {
      const pos = posMap[device.id];
      if (!pos || !pos.valid || (pos.latitude === 0 && pos.longitude === 0)) {
        if (markersRef.current.has(device.id)) {
          map.removeLayer(markersRef.current.get(device.id)!);
          markersRef.current.delete(device.id);
        }
        return;
      }

      const color = getMarkerColor(device, pos);
      const isSelected = selectedDeviceId === device.id;
      const vType = vehiclePrefs[device.id] || 'car';
      const iw = isSelected ? 38 : 30;
      const ih = isSelected ? 62 : 50;
      const icon = L.divIcon({
        html: createVehicleIcon(color, isSelected, vType, device.name),
        className: '',
        iconSize: [iw, ih + 20],
        iconAnchor: [iw / 2, ih / 2],
      });

      if (markersRef.current.has(device.id)) {
        const marker = markersRef.current.get(device.id)!;
        const from = marker.getLatLng();
        if (Math.abs(from.lat - pos.latitude) > 0.000005 || Math.abs(from.lng - pos.longitude) > 0.000005) {
          animateMarker(marker, device.id, from.lat, from.lng, pos.latitude, pos.longitude, 2800);
          if (device.id === selectedDeviceId) {
            map.panTo([pos.latitude, pos.longitude], { animate: true, duration: 1.5 });
          }
        }
        marker.setIcon(icon);
      } else {
        const marker = L.marker([pos.latitude, pos.longitude], { icon })
          .addTo(map)
          .on('click', () => onDeviceSelect(device.id));
        markersRef.current.set(device.id, marker);
      }
    });

    if (!hasFittedRef.current) {
      const valid = positions.filter(p => p.valid && !(p.latitude === 0 && p.longitude === 0));
      if (valid.length === 1) {
        map.setView([valid[0].latitude, valid[0].longitude], 15);
        hasFittedRef.current = true;
      } else if (valid.length > 1) {
        const bounds = L.latLngBounds(valid.map(p => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        hasFittedRef.current = true;
      }
    }
  }, [devices, positions, selectedDeviceId, onDeviceSelect, vehiclePrefs]);

  // Fly to selected device
  useEffect(() => {
    if (!mapRef.current || selectedDeviceId === null) return;
    const marker = markersRef.current.get(selectedDeviceId);
    if (marker) mapRef.current.flyTo(marker.getLatLng(), 16, { duration: 0.8 });
  }, [selectedDeviceId]);

  // Center on selected device when triggered
  useEffect(() => {
    if (!mapRef.current || selectedDeviceId === null || centerTrigger === 0) return;
    const marker = markersRef.current.get(selectedDeviceId);
    if (marker) mapRef.current.flyTo(marker.getLatLng(), 17, { duration: 0.5 });
  }, [centerTrigger, selectedDeviceId]);

  // Live trail polyline for selected device
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = mapRef.current as LeafletMap;

    if (polylineRef.current) {
      try { map.removeLayer(polylineRef.current as Parameters<LeafletMap['removeLayer']>[0]); } catch { /**/ }
      polylineRef.current = null;
    }
    if (selectedDeviceId === null || !liveTrail) return;
    const trail = liveTrail.get(selectedDeviceId);
    if (!trail || trail.length < 2) return;

    polylineRef.current = L.polyline(trail, {
      color: '#007AFF',
      weight: 4,
      opacity: 0.75,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
  }, [selectedDeviceId, liveTrail]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Map type toggle button */}
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
              {([
                { key: 'normal'   as const, label: 'Normal',   lyrs: 'm', fallback: '#e2e8f0' },
                { key: 'hibrido'  as const, label: 'Híbrido',  lyrs: 'y', fallback: '#1a3320' },
                { key: 'satelite' as const, label: 'Satélite', lyrs: 's', fallback: '#0d1f0d' },
                { key: 'terreno'  as const, label: 'Terreno',  lyrs: 'p', fallback: '#7a6540' },
              ]).map(cfg => (
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
                  <div style={{ width: '96px', height: '64px', borderRadius: '6px', overflow: 'hidden', background: cfg.fallback }}>
                    <img
                      src={`https://mt0.google.com/vt/lyrs=${cfg.lyrs}&x=94&y=145&z=8`}
                      alt={cfg.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
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
