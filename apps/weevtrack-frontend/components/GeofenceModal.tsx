'use client';

import { useState, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

interface Geofence { id: number; name: string; area: string; }

interface Props {
  deviceId: number;
  deviceName: string;
  lat?: number;
  lon?: number;
  onClose: () => void;
}

function fmtR(m: number) { return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`; }

export default function GeofenceModal({ deviceId, deviceName, lat = -15.78, lon = -47.93, onClose }: Props) {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [radius, setRadius] = useState(500);
  const [centerLat, setCenterLat] = useState(lat);
  const [centerLon, setCenterLon] = useState(lon);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const latRef = useRef(lat);
  const lonRef = useRef(lon);

  useEffect(() => {
    fetch(`/api/geofences?deviceId=${deviceId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setGeofences(data); })
      .catch(() => {});
  }, [deviceId]);

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current || !containerRef.current) return;
    const L = require('leaflet');

    const map = L.map(containerRef.current, { center: [lat, lon], zoom: 15 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);

    circleRef.current = L.circle([lat, lon], {
      radius: 500, color: '#FF3B30', fillColor: '#FF3B30', fillOpacity: 0.15, weight: 2,
    }).addTo(map);

    const centerIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;background:#FF3B30;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
    });

    markerRef.current = L.marker([lat, lon], { icon: centerIcon, draggable: true }).addTo(map);
    markerRef.current.on('dragend', (e: any) => {
      const { lat: la, lng: lo } = e.target.getLatLng();
      latRef.current = la; lonRef.current = lo;
      setCenterLat(la); setCenterLon(lo);
      circleRef.current?.setLatLng([la, lo]);
    });

    map.on('click', (e: any) => {
      const { lat: la, lng: lo } = e.latlng;
      latRef.current = la; lonRef.current = lo;
      setCenterLat(la); setCenterLon(lo);
      markerRef.current?.setLatLng([la, lo]);
      circleRef.current?.setLatLng([la, lo]);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { circleRef.current?.setRadius(radius); }, [radius]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name: `Cerca — ${deviceName}`, lat: centerLat, lon: centerLon, radius }),
      });
      if (res.ok) {
        const gf = await res.json();
        setGeofences(prev => [...prev, gf]);
        setMsg('✅ Cerca criada! O cliente será notificado ao sair da área.');
      } else setMsg('❌ Erro ao criar cerca');
    } catch { setMsg('❌ Erro de conexão'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  }

  async function deleteFence(gid: number) {
    if (!confirm('Excluir esta cerca virtual?')) return;
    const res = await fetch('/api/geofences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geofenceId: gid, deviceId }),
    });
    if (res.ok) { setGeofences(prev => prev.filter(g => g.id !== gid)); setMsg('✅ Cerca excluída'); }
    else setMsg('❌ Erro ao excluir');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-border)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-hi)' }}>Cerca Virtual</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-lo)' }}>{deviceName}</p>
        </div>
        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontWeight: 600 }}>
          🚧 {geofences.length} ativa{geofences.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 280 }} />
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 11, padding: '5px 10px', borderRadius: 8, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          Toque no mapa para posicionar a cerca
        </div>
      </div>

      <div style={{ flexShrink: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', padding: '14px 16px 28px' }}>
        {msg && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, fontSize: 12, textAlign: 'center', background: msg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: msg.startsWith('✅') ? '#34C759' : '#FF3B30', border: `1px solid ${msg.startsWith('✅') ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)'}` }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-lo)', flexShrink: 0, minWidth: 36 }}>Raio</span>
          <input type="range" min="100" max="5000" step="50" value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#FF3B30' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-hi)', minWidth: 58, textAlign: 'right' }}>{fmtR(radius)}</span>
        </div>

        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#FF3B30', color: 'white', fontWeight: 700, padding: '13px', borderRadius: 12, border: 'none', fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, marginBottom: geofences.length > 0 ? 12 : 0 }}>
          {saving ? 'Salvando...' : '+ Criar cerca nesta área'}
        </button>

        {geofences.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-lo)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 4 }}>Cercas ativas</p>
            {geofences.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 10, marginBottom: 6, border: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-hi)' }}>🚧 {g.name}</span>
                <button onClick={() => deleteFence(g.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
