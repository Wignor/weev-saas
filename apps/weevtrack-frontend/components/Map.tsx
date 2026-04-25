'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

interface MapProps {
  devices: TraccarDevice[];
  positions: TraccarPosition[];
  selectedDeviceId: number | null;
  onDeviceSelect: (id: number) => void;
  visible?: boolean;
  centerTrigger?: number;
}

function getMarkerColor(device: TraccarDevice, position?: TraccarPosition): string {
  if (device.status === 'offline' || device.status === 'unknown') return '#6B7280';
  if (position && knotsToKmh(position.speed) > 2) return '#34C759';
  return '#FF9500';
}

function createCarIcon(color: string, isSelected: boolean): string {
  const size = isSelected ? 48 : 38;
  const shadow = isSelected
    ? 'filter: drop-shadow(0 0 10px rgba(0,122,255,0.7));'
    : 'filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));';
  return `
    <div style="width:${size}px;height:${size}px;${shadow}position:relative;">
      <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="24" fill="${color}" opacity="${isSelected ? '1' : '0.92'}"/>
        ${isSelected ? `<circle cx="24" cy="24" r="21" stroke="white" stroke-width="2.5" fill="none"/>` : ''}
        <path d="M14 28L15.5 21.5H32.5L34 28H14Z" fill="white"/>
        <path d="M15.5 21.5L17.5 15.5H30.5L32.5 21.5" fill="white" opacity="0.75"/>
        <circle cx="18.5" cy="29.5" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
        <circle cx="29.5" cy="29.5" r="2.5" fill="${color}" stroke="white" stroke-width="1.8"/>
      </svg>
    </div>
  `;
}

export default function VehicleMap({
  devices = [], positions = [], selectedDeviceId, onDeviceSelect, visible = true, centerTrigger = 0,
}: MapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<globalThis.Map<number, Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFittedRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;

    const L = require('leaflet');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    const map = L.map(containerRef.current, {
      center: [-15.7801, -47.9292],
      zoom: 5,
      zoomControl: true,
    });

    // Dark tiles (CartoDB dark matter) for dark mode, light for light mode
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com">CARTO</a>',
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      hasFittedRef.current = false;
    };
  }, []);

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
      const icon = L.divIcon({
        html: createCarIcon(color, isSelected),
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

    // Auto-fit to show all vehicles on first data load
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
  }, [devices, positions, selectedDeviceId, onDeviceSelect]);

  // Fly to selected device
  useEffect(() => {
    if (!mapRef.current || selectedDeviceId === null) return;
    const marker = markersRef.current.get(selectedDeviceId);
    if (marker) {
      mapRef.current.flyTo(marker.getLatLng(), 16, { duration: 0.8 });
    }
  }, [selectedDeviceId]);

  // Center on selected device when triggered (Centralizar button)
  useEffect(() => {
    if (!mapRef.current || selectedDeviceId === null || centerTrigger === 0) return;
    const marker = markersRef.current.get(selectedDeviceId);
    if (marker) {
      mapRef.current.flyTo(marker.getLatLng(), 17, { duration: 0.5 });
    }
  }, [centerTrigger, selectedDeviceId]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
  );
}
