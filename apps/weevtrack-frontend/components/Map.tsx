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
  const size = isSelected ? 46 : 36;
  const iconSz = Math.round(size * 0.58);
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label = safeName
    ? `<div style="margin-top:4px;background:rgba(0,0,0,0.72);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;text-align:center;pointer-events:none">${safeName}</div>`
    : '';
  const ring = isSelected
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:3px solid ${color};opacity:0.35;pointer-events:none"></div>`
    : '';

  let shapes: string;
  switch (vehicleType) {
    case 'motorcycle':
      shapes = `
        <ellipse cx="11" cy="3" rx="3.5" ry="2" fill="white"/>
        <rect x="9.5" y="5" width="3" height="4" rx="1" fill="white"/>
        <rect x="1" y="8" width="20" height="3" rx="1.5" fill="white"/>
        <ellipse cx="11" cy="17" rx="5" ry="6.5" fill="white"/>
        <ellipse cx="11" cy="17" rx="2.5" ry="3" fill="rgba(0,0,0,0.2)"/>
        <ellipse cx="11" cy="27.5" rx="3.5" ry="2" fill="white"/>`;
      break;
    case 'truck':
      shapes = `
        <rect x="2" y="1" width="18" height="11" rx="2" fill="white"/>
        <rect x="3.5" y="2.5" width="15" height="5" rx="1" fill="rgba(0,0,0,0.2)"/>
        <rect x="2" y="14" width="18" height="15" rx="1.5" fill="white"/>
        <line x1="11" y1="14.5" x2="11" y2="28.5" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`;
      break;
    case 'bus':
      shapes = `
        <rect x="2" y="1" width="18" height="28" rx="3.5" fill="white"/>
        <rect x="3.5" y="6" width="7" height="5" rx="1" fill="rgba(0,0,0,0.2)"/>
        <rect x="11.5" y="6" width="7" height="5" rx="1" fill="rgba(0,0,0,0.2)"/>
        <rect x="3.5" y="14" width="7" height="5" rx="1" fill="rgba(0,0,0,0.2)"/>
        <rect x="11.5" y="14" width="7" height="5" rx="1" fill="rgba(0,0,0,0.2)"/>`;
      break;
    case 'pickup':
      shapes = `
        <rect x="2" y="1" width="18" height="18" rx="2" fill="white"/>
        <rect x="3.5" y="2.5" width="15" height="7" rx="1" fill="rgba(0,0,0,0.2)"/>
        <rect x="2" y="21" width="18" height="8" rx="1.5" fill="white"/>`;
      break;
    case 'universal':
      shapes = `
        <path fill="white" d="M11 1 C5 1 1 5.5 1 11 C1 19 11 29 11 29 C11 29 21 19 21 11 C21 5.5 17 1 11 1Z"/>
        <circle cx="11" cy="11" r="4" fill="rgba(0,0,0,0.2)"/>`;
      break;
    default: // car — top-view with windshield + rear window
      shapes = `
        <path fill="white" d="M11 2 C7 2 4 3.5 4 6 L4 8 Q3.5 10 3.5 13 L3.5 18.5 Q3.5 21.5 4 22.5 L4 24 C4 25 7 25.5 11 25.5 C15 25.5 18 25 18 24 L18 22.5 Q18.5 21.5 18.5 18.5 L18.5 13 Q18.5 10 18 8 L18 6 C18 3.5 15 2 11 2 Z"/>
        <path fill="rgba(0,0,0,0.22)" d="M5.5 8.5 Q5 10 5 11.5 L17 11.5 Q17 10 16.5 8.5 Z"/>
        <path fill="rgba(0,0,0,0.22)" d="M5.5 19.5 Q5.5 21.5 6 23 L16 23 Q16.5 21.5 16.5 19.5 Z"/>`;
  }

  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">
    <div style="position:relative;width:${size}px;height:${size}px">
      ${ring}
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.5)${isSelected ? ';outline:2.5px solid white;outline-offset:1px' : ''};box-sizing:border-box">
        <svg width="${iconSz}" height="${iconSz}" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${shapes}
        </svg>
      </div>
    </div>
    ${label}
  </div>`;
}

const geocodeCache = new Map<string, string>();
const geocodePending = new Set<string>();

function reverseGeocode(lat: number, lng: number, onResult: (addr: string) => void): void {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(key)) { onResult(geocodeCache.get(key)!); return; }
  if (geocodePending.has(key)) return;
  geocodePending.add(key);
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`, {
    headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'WeevTrack/1.0' },
  }).then(r => r.json()).then(data => {
    const addr = data.address;
    const road = addr?.road || addr?.pedestrian || addr?.path || '';
    const sub = addr?.suburb || addr?.neighbourhood || addr?.city_district || '';
    const result = road ? (sub ? `${road}, ${sub}` : road)
      : (data.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    geocodeCache.set(key, result);
    onResult(result);
  }).catch(() => {
    const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache.set(key, fallback);
    onResult(fallback);
  }).finally(() => { geocodePending.delete(key); });
}

function createTooltipHtml(name: string, speedKnots: number, ignition: boolean | undefined, lat: number, lng: number, fixTime: string, address?: string): string {
  const speedKmh = knotsToKmh(speedKnots);
  const ignLabel = ignition === true ? '🔑 Ligado' : ignition === false ? '🔒 Desligado' : '—';
  const time = fixTime
    ? new Date(fixTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : '—';
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const locStr = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return `<div style="font-family:system-ui;min-width:160px">
    <div style="font-weight:700;font-size:13px;color:#111;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb">${safeName}</div>
    <div style="font-size:12px;color:#374151;margin-bottom:3px">🚗 <strong>${speedKmh}</strong> km/h</div>
    <div style="font-size:12px;color:#374151;margin-bottom:3px">${ignLabel}</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:3px">📍 ${locStr}</div>
    <div style="font-size:11px;color:#6b7280">🕐 ${time}</div>
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
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const userMarkerRef = useRef<Marker | null>(null);

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
    // Use scale=2 for retina/HiDPI screens to avoid blur on mobile
    const retina = typeof window !== 'undefined' && window.devicePixelRatio > 1;
    const scale = retina ? '&scale=2' : '';
    const GOOGLE: Record<string, string> = {
      normal:   `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${scale}`,
      hibrido:  `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}${scale}`,
      satelite: `https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}${scale}`,
      terreno:  `https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}${scale}`,
    };
    const map = mapRef.current as LeafletMap;
    tileLayerRef.current = L.tileLayer(GOOGLE[mapLayer], {
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google Maps',
      maxZoom: 22, maxNativeZoom: 22,
      tileSize: retina ? 512 : 256,
      zoomOffset: retina ? -1 : 0,
    }).addTo(map);
  }, [mapLayer]);

  // Recalculate size + auto-fit when map becomes visible (mobile toggle)
  useEffect(() => {
    if (!visible || !mapRef.current) return;
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
      if (!hasFittedRef.current) {
        const L = require('leaflet');
        const valid = positions.filter(p => !(p.latitude === 0 && p.longitude === 0) && Math.abs(p.latitude) > 0.001);
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

    // Remove markers for devices no longer in the list
    const currentIds = new Set(devices.map(d => d.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    devices.forEach((device) => {
      const pos = posMap[device.id];
      const hasCoords = pos && !(pos.latitude === 0 && pos.longitude === 0) && Math.abs(pos.latitude) > 0.001;
      if (!hasCoords) {
        if (markersRef.current.has(device.id)) {
          map.removeLayer(markersRef.current.get(device.id)!);
          markersRef.current.delete(device.id);
        }
        return;
      }

      const color = getMarkerColor(device, pos);
      const isSelected = selectedDeviceId === device.id;
      const vType = vehiclePrefs[device.id] || 'car';
      const size = isSelected ? 46 : 36;
      const icon = L.divIcon({
        html: createVehicleIcon(color, isSelected, vType, device.name),
        className: '',
        iconSize: [size, size + 20],
        iconAnchor: [size / 2, size / 2],
      });
      const geoKey = `${pos.latitude.toFixed(4)},${pos.longitude.toFixed(4)}`;
      const cachedAddr = geocodeCache.get(geoKey);
      const tooltipHtml = createTooltipHtml(
        device.name, pos.speed || 0, pos.attributes?.ignition as boolean | undefined,
        pos.latitude, pos.longitude, pos.fixTime, cachedAddr,
      );

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
        if (marker.getTooltip()) {
          marker.setTooltipContent(tooltipHtml);
        } else {
          marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -(size / 2 + 4)], className: 'wt-tooltip' });
        }
      } else {
        const marker = L.marker([pos.latitude, pos.longitude], { icon })
          .addTo(map)
          .on('click', () => onDeviceSelect(device.id))
          .bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -(size / 2 + 4)], className: 'wt-tooltip' });
        markersRef.current.set(device.id, marker);
      }

      const currentMarker = markersRef.current.get(device.id);
      if (currentMarker && !cachedAddr) {
        currentMarker.off('tooltipopen');
        currentMarker.on('tooltipopen', () => {
          reverseGeocode(pos.latitude, pos.longitude, (addr) => {
            const m = markersRef.current.get(device.id);
            if (m && m.getTooltip()) {
              m.setTooltipContent(createTooltipHtml(device.name, pos.speed || 0, pos.attributes?.ignition as boolean | undefined, pos.latitude, pos.longitude, pos.fixTime, addr));
            }
          });
        });
      }
    });

    if (!hasFittedRef.current) {
      const valid = positions.filter(p => !(p.latitude === 0 && p.longitude === 0) && Math.abs(p.latitude) > 0.001);
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

  // User geolocation marker
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || !userPos) return;
    const L = require('leaflet');
    const map = mapRef.current as LeafletMap;
    const icon = L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#007AFF;border:3px solid white;box-shadow:0 0 0 3px rgba(0,122,255,0.35)"></div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userPos);
    } else {
      userMarkerRef.current = L.marker(userPos, { icon, zIndexOffset: 1000 }).addTo(map);
    }
    map.flyTo(userPos, Math.max((map as LeafletMap).getZoom(), 16), { duration: 0.8 });
  }, [userPos]);

  function locateUser() {
    if (!navigator.geolocation) { alert('Geolocalização não suportada neste dispositivo.'); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos([pos.coords.latitude, pos.coords.longitude]); setLocLoading(false); },
      () => { setLocLoading(false); alert('Não foi possível obter sua localização.'); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function navigateToVehicle() {
    if (!userPos || !selectedDeviceId) return;
    const posObj = positions.find(p => p.deviceId === selectedDeviceId);
    if (!posObj) return;
    const url = `https://www.google.com/maps/dir/${userPos[0]},${userPos[1]}/${posObj.latitude},${posObj.longitude}`;
    window.open(url, '_blank');
  }

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

      {/* Geolocation button — below the Mapa button */}
      <button
        onClick={locateUser}
        title="Minha localização"
        style={{
          position: 'absolute', top: 56, right: 10, zIndex: 900,
          width: '36px', height: '36px',
          background: userPos ? '#007AFF' : 'white',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '8px', cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: locLoading ? 0.6 : 1,
        }}
      >
        {locLoading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={userPos ? 'white' : '#007AFF'} strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={userPos ? 'white' : '#007AFF'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
          </svg>
        )}
      </button>

      {/* Navigate to vehicle button (only when user located + vehicle selected) */}
      {userPos && selectedDeviceId !== null && positions.some(p => p.deviceId === selectedDeviceId) && (
        <button
          onClick={navigateToVehicle}
          title="Como chegar ao veículo"
          style={{
            position: 'absolute', top: 100, right: 10, zIndex: 900,
            background: '#34C759', border: 'none',
            borderRadius: '8px', padding: '5px 9px',
            fontSize: '11px', fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: '5px', color: 'white',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          Navegar
        </button>
      )}

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
