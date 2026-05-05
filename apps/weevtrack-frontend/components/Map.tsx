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
    ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 3px 10px rgba(0,0,0,0.9))`
    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.85))';
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label = safeName ? `<div style="margin-top:3px;background:rgba(0,0,0,0.78);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:5px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;text-align:center;pointer-events:none">${safeName}</div>` : '';

  const sc  = isSelected ? 1.35 : 1;
  const sw  = isSelected ? '2.5' : '1.7';   // main stroke width
  const sw2 = isSelected ? '1.7' : '1.1';   // detail stroke width
  const sw3 = isSelected ? '2.8' : '2.0';   // guidão / heavy elements

  let vw: number, vh: number, shapes: string;

  switch (vehicleType) {
    case 'motorcycle':
      vw = 18; vh = 30;
      shapes = `
        <ellipse cx="9" cy="3.5" rx="3" ry="1.8" stroke="${color}" stroke-width="${sw2}" fill="none"/>
        <line x1="7.5" y1="5" x2="7.5" y2="9" stroke="${color}" stroke-width="1.2"/>
        <line x1="10.5" y1="5" x2="10.5" y2="9" stroke="${color}" stroke-width="1.2"/>
        <line x1="2" y1="8" x2="16" y2="8" stroke="${color}" stroke-width="${sw3}" stroke-linecap="round"/>
        <ellipse cx="9" cy="16" rx="4" ry="5" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <path d="M6.5 20.5 Q9 22 11.5 20.5" stroke="${color}" stroke-width="${sw2}" fill="none" stroke-linecap="round"/>
        <ellipse cx="9" cy="27" rx="3" ry="1.8" stroke="${color}" stroke-width="${sw2}" fill="none"/>`;
      break;
    case 'truck':
      vw = 20; vh = 36;
      shapes = `
        <path d="M3 1 Q1 1 1 3 L1 11 Q1 13 3 13 L17 13 Q19 13 19 11 L19 3 Q19 1 17 1 Z" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <path d="M2.5 7.5 Q2 6 3 4.5 L17 4.5 Q18 6 17.5 7.5 Z" stroke="${color}" stroke-width="${sw2}" fill="none"/>
        <line x1="7" y1="13" x2="7" y2="15.5" stroke="${color}" stroke-width="1.3"/>
        <line x1="13" y1="13" x2="13" y2="15.5" stroke="${color}" stroke-width="1.3"/>
        <line x1="7" y1="15" x2="13" y2="15" stroke="${color}" stroke-width="1.3"/>
        <rect x="1" y="16.5" width="18" height="18.5" rx="1.5" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <line x1="10" y1="17" x2="10" y2="34.5" stroke="${color}" stroke-width="0.9" opacity="0.45"/>`;
      break;
    case 'bus':
      vw = 18; vh = 34;
      shapes = `
        <rect x="1" y="1" width="16" height="32" rx="4" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <line x1="2.5" y1="7" x2="15.5" y2="7" stroke="${color}" stroke-width="${sw2}" stroke-linecap="round"/>
        <rect x="2.5" y="10" width="5" height="4" rx="1" stroke="${color}" stroke-width="1" fill="none"/>
        <rect x="10.5" y="10" width="5" height="4" rx="1" stroke="${color}" stroke-width="1" fill="none"/>
        <rect x="2.5" y="17" width="5" height="4" rx="1" stroke="${color}" stroke-width="1" fill="none"/>
        <rect x="10.5" y="17" width="5" height="4" rx="1" stroke="${color}" stroke-width="1" fill="none"/>
        <line x1="2.5" y1="26" x2="15.5" y2="26" stroke="${color}" stroke-width="${sw2}" stroke-linecap="round"/>`;
      break;
    case 'pickup':
      vw = 22; vh = 32;
      shapes = `
        <path d="M3 1 Q1 1 1 3 L1 5.5 Q1 7 1 9 L1 19 Q1 20.5 3 20.5 L19 20.5 Q21 20.5 21 19 L21 9 Q21 7 21 5.5 L21 3 Q21 1 19 1 Z" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <path d="M2.5 9 Q2 7 3 5.5 L19 5.5 Q20 7 19.5 9 Z" stroke="${color}" stroke-width="${sw2}" fill="none"/>
        <rect x="1" y="22.5" width="20" height="8.5" rx="2" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <line x1="3.5" y1="22.5" x2="3.5" y2="31" stroke="${color}" stroke-width="1" opacity="0.45"/>
        <line x1="18.5" y1="22.5" x2="18.5" y2="31" stroke="${color}" stroke-width="1" opacity="0.45"/>`;
      break;
    case 'universal':
      vw = 20; vh = 28;
      shapes = `
        <path d="M10 1 C5 1 1 5 1 10 C1 17.5 10 27 10 27 C10 27 19 17.5 19 10 C19 5 15 1 10 1Z" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <circle cx="10" cy="10" r="3.5" stroke="${color}" stroke-width="${sw2}" fill="none"/>`;
      break;
    default: // car — silhueta orgânica com para-brisas
      vw = 17; vh = 30;
      shapes = `
        <path d="M8.5 1 C5.5 1 2 2.5 2 5 L2 6.5 Q1 9 1 13 L1 20 Q1 24 2 25.5 L2 27 C2 28.5 5.5 29 8.5 29 C11.5 29 15 28.5 15 27 L15 25.5 Q16 24 16 20 L16 13 Q16 9 15 6.5 L15 5 C15 2.5 11.5 1 8.5 1Z" stroke="${color}" stroke-width="${sw}" fill="none"/>
        <path d="M3.5 6.5 Q3 9 3 10.5 L14 10.5 Q14 9 13.5 6.5 Z" stroke="${color}" stroke-width="${sw2}" fill="none"/>
        <path d="M3 21.5 Q3 23 3.5 25.5 L13.5 25.5 Q14 23 14 21.5 Z" stroke="${color}" stroke-width="${sw2}" fill="none"/>`;
  }

  const svgW = Math.round(vw * sc);
  const svgH = Math.round(vh * sc);
  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${vw} ${vh}" fill="none" style="filter:${shadow}">
      ${shapes}
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
      const iw = isSelected ? 30 : 22;
      const ih = isSelected ? 49 : 36;
      const icon = L.divIcon({
        html: createVehicleIcon(color, isSelected, vType, device.name),
        className: '',
        iconSize: [iw, ih + 18],
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
