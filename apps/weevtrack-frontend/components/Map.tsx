'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

interface MapProps {
  devices: TraccarDevice[];
  positions: TraccarPosition[];
  selectedDeviceId: number | null;
  onDeviceSelect: (id: number) => void;
}

function getMarkerColor(device: TraccarDevice, position?: TraccarPosition): string {
  if (device.status === 'offline' || device.status === 'unknown') return '#808080';
  if (position && knotsToKmh(position.speed) > 2) return '#34C759';
  return '#FF9500';
}

function createCarIcon(color: string, isSelected: boolean): string {
  const size = isSelected ? 44 : 36;
  const shadow = isSelected ? 'filter: drop-shadow(0 4px 8px rgba(0,122,255,0.4));' : 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));';
  return `
    <div style="width:${size}px;height:${size}px;${shadow}">
      <svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="22" fill="${color}" opacity="${isSelected ? '1' : '0.9'}"/>
        ${isSelected ? `<circle cx="22" cy="22" r="20" stroke="white" stroke-width="2" fill="none"/>` : ''}
        <path d="M13 26L14.5 20H29.5L31 26H13Z" fill="white"/>
        <path d="M14.5 20L16 15H28L29.5 20" fill="white" opacity="0.7"/>
        <circle cx="17" cy="27" r="2" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="27" cy="27" r="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `;
}

export default function Map({ devices, positions, selectedDeviceId, onDeviceSelect }: MapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;

    const L = require('leaflet');

    const map = L.map(containerRef.current, {
      center: [-15.7801, -47.9292],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

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
      const speed = knotsToKmh(pos.speed);
      const ignition = pos.attributes?.ignition;

      const icon = L.divIcon({
        html: createCarIcon(color, isSelected),
        className: '',
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      });

      const popupContent = `
        <div style="font-family:-apple-system,sans-serif;min-width:180px;">
          <div style="font-weight:700;font-size:14px;color:#1A1A1A;margin-bottom:8px;">${device.name}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-size:12px;color:#808080;">
              <b style="color:#1A1A1A;">Velocidade:</b> ${speed} km/h
            </div>
            <div style="font-size:12px;color:#808080;">
              <b style="color:#1A1A1A;">Ignição:</b> ${ignition ? '✅ Ligada' : '⭕ Desligada'}
            </div>
            <div style="font-size:12px;color:#808080;">
              <b style="color:#1A1A1A;">Posição:</b> ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}
            </div>
            <div style="font-size:11px;color:#808080;margin-top:4px;">
              ${new Date(pos.fixTime).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      `;

      if (markersRef.current.has(device.id)) {
        const marker = markersRef.current.get(device.id)!;
        marker.setLatLng([pos.latitude, pos.longitude]);
        marker.setIcon(icon);
        marker.getPopup()?.setContent(popupContent);
      } else {
        const marker = L.marker([pos.latitude, pos.longitude], { icon })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 240 })
          .on('click', () => onDeviceSelect(device.id));
        markersRef.current.set(device.id, marker);
      }
    });
  }, [devices, positions, selectedDeviceId, onDeviceSelect]);

  // Centralizar no dispositivo selecionado
  useEffect(() => {
    if (!mapRef.current || selectedDeviceId === null) return;

    const marker = markersRef.current.get(selectedDeviceId);
    if (marker) {
      mapRef.current.flyTo(marker.getLatLng(), 15, { duration: 1 });
      marker.openPopup();
    }
  }, [selectedDeviceId]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full" style={{ minHeight: '400px' }} />
  );
}
