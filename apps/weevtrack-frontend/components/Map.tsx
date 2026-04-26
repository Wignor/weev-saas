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
}

function getMarkerColor(device: TraccarDevice, position?: TraccarPosition): string {
  if (device.status === 'offline' || device.status === 'unknown') return '#6B7280';
  if (position && knotsToKmh(position.speed) > 2) return '#34C759';
  return '#FF9500';
}

function createVehicleIcon(color: string, isSelected: boolean, vehicleType = 'car'): string {
  const size = isSelected ? 48 : 38;
  const shadow = isSelected
    ? 'filter: drop-shadow(0 0 10px rgba(0,122,255,0.7));'
    : 'filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));';
  const ring = isSelected ? `<circle cx="24" cy="24" r="21" stroke="white" stroke-width="2.5" fill="none"/>` : '';

  let shape: string;
  switch (vehicleType) {
    case 'motorcycle':
      shape = `
        <circle cx="15" cy="30" r="5" fill="none" stroke="white" stroke-width="2"/>
        <circle cx="33" cy="30" r="5" fill="none" stroke="white" stroke-width="2"/>
        <path d="M20 30L24 18L28 24L33 25" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M15 25L20 30" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <circle cx="24" cy="17" r="2" fill="white"/>`;
      break;
    case 'truck':
      shape = `
        <rect x="9" y="19" width="20" height="11" rx="1" fill="white" opacity="0.85"/>
        <rect x="29" y="22" width="10" height="8" rx="1" fill="white"/>
        <circle cx="15" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
        <circle cx="33" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>`;
      break;
    case 'bus':
      shape = `
        <rect x="11" y="14" width="26" height="16" rx="2" fill="white" opacity="0.85"/>
        <rect x="13" y="17" width="5" height="4" rx="1" fill="${color}"/>
        <rect x="21" y="17" width="5" height="4" rx="1" fill="${color}"/>
        <rect x="29" y="17" width="5" height="4" rx="1" fill="${color}"/>
        <circle cx="17" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
        <circle cx="31" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>`;
      break;
    case 'pickup':
      shape = `
        <rect x="10" y="20" width="16" height="10" rx="2" fill="white" opacity="0.85"/>
        <rect x="12" y="20" width="10" height="5" rx="1" fill="${color}" opacity="0.5"/>
        <rect x="26" y="22" width="12" height="8" rx="1" fill="white" opacity="0.55"/>
        <line x1="26" y1="22" x2="26" y2="30" stroke="white" stroke-width="1.5"/>
        <circle cx="16" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
        <circle cx="33" cy="30" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>`;
      break;
    case 'boat':
      shape = `
        <path d="M12 26L16 16H32L36 26Z" fill="white" opacity="0.85"/>
        <path d="M8 28Q24 34 40 28" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M24 12V16" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <path d="M24 12L30 19" stroke="white" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/>`;
      break;
    default: // car
      shape = `
        <path d="M14 28L15.5 21.5H32.5L34 28H14Z" fill="white"/>
        <path d="M15.5 21.5L17.5 15.5H30.5L32.5 21.5" fill="white" opacity="0.75"/>
        <circle cx="18.5" cy="29.5" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
        <circle cx="29.5" cy="29.5" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>`;
  }

  return `<div style="width:${size}px;height:${size}px;${shadow}">
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="${color}" opacity="${isSelected ? '1' : '0.92'}"/>
      ${ring}${shape}
    </svg>
  </div>`;
}

export default function VehicleMap({
  devices = [], positions = [], selectedDeviceId, onDeviceSelect,
  visible = true, centerTrigger = 0, vehiclePrefs = {},
}: MapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<globalThis.Map<number, Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFittedRef = useRef(false);
  const tileLayerRef = useRef<unknown>(null);
  const isDarkRef = useRef(false);
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');

  // Initialize map (no tile layer — added by tile effect below)
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;
    const L = require('leaflet');
    isDarkRef.current = document.documentElement.getAttribute('data-theme') !== 'light';
    const map = L.map(containerRef.current, { center: [-15.7801, -47.9292], zoom: 5, zoomControl: true });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current.clear();
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
    if (mapLayer === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 19 }
      ).addTo(mapRef.current);
    } else {
      const url = isDarkRef.current
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileLayerRef.current = L.tileLayer(url, {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20, subdomains: 'abcd',
      }).addTo(mapRef.current);
    }
  }, [mapLayer]);

  // Recalculate size when map becomes visible (mobile toggle)
  useEffect(() => {
    if (!visible || !mapRef.current) return;
    const timer = setTimeout(() => { mapRef.current?.invalidateSize(); }, 50);
    return () => clearTimeout(timer);
  }, [visible]);

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
      const icon = L.divIcon({
        html: createVehicleIcon(color, isSelected, vType),
        className: '',
        iconSize: [isSelected ? 48 : 38, isSelected ? 48 : 38],
        iconAnchor: [isSelected ? 24 : 19, isSelected ? 24 : 19],
      });

      if (markersRef.current.has(device.id)) {
        const marker = markersRef.current.get(device.id)!;
        marker.setLatLng([pos.latitude, pos.longitude]);
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

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <button
        onClick={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 800,
          background: 'white', border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '8px', padding: '5px 10px',
          fontSize: '12px', fontWeight: '600', cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '5px', color: '#333',
        }}
      >
        {mapLayer === 'street' ? '🛰️ Satélite' : '🗺️ Mapa'}
      </button>
    </div>
  );
}
