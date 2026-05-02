'use client';

import { useState, useEffect } from 'react';

interface Geofence {
  id: number;
  name: string;
  area: string;
}

interface Props {
  deviceId: number;
  clientId?: number;
  apiBase: string;
  onMessage: (msg: string) => void;
}

const RADIUS_OPTIONS = [
  { label: '100 m', value: 100 },
  { label: '250 m', value: 250 },
  { label: '500 m', value: 500 },
  { label: '1 km',  value: 1000 },
  { label: '2 km',  value: 2000 },
  { label: '5 km',  value: 5000 },
];

function parseRadius(area: string): number | null {
  const m = area.match(/CIRCLE\s*\([^,]+,\s*(\d+\.?\d*)\)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

function fmtRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=pt-BR`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

export default function GeofenceSection({ deviceId, clientId, apiBase, onMessage }: Props) {
  const [expanded, setExpanded]   = useState(false);
  const [geofences, setGeofences] = useState<Geofence[] | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', address: '', radius: 500 });
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (expanded && geofences === null) load();
  }, [expanded]);

  async function load() {
    try {
      const r = await fetch(`${apiBase}?deviceId=${deviceId}`);
      const d = await r.json();
      setGeofences(Array.isArray(d) ? d : []);
    } catch { setGeofences([]); }
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.address.trim()) return;
    setSaving(true);
    setGeocoding(true);
    const coords = await geocodeAddress(form.address);
    setGeocoding(false);
    if (!coords) {
      onMessage('❌ Endereço não encontrado. Tente ser mais específico.');
      setSaving(false);
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      lat: coords.lat,
      lon: coords.lon,
      radius: form.radius,
      deviceId,
    };
    if (clientId != null) body.clientId = clientId;

    const r = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const data = await r.json();
      setGeofences(prev => [...(prev || []), data.geofence]);
      setForm({ name: '', address: '', radius: 500 });
      setShowForm(false);
      onMessage('✅ Geocerca criada');
    } else {
      const err = await r.json().catch(() => ({}));
      onMessage(`❌ ${err.error || 'Erro ao criar geocerca'}`);
    }
    setSaving(false);
  }

  async function handleDelete(g: Geofence) {
    if (!confirm(`Excluir a geocerca "${g.name}"?`)) return;
    const body: Record<string, unknown> = { geofenceId: g.id, deviceId };
    if (clientId != null) body.clientId = clientId;

    const r = await fetch(apiBase, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      setGeofences(prev => (prev || []).filter(x => x.id !== g.id));
      onMessage('✅ Geocerca removida');
    } else {
      onMessage('❌ Erro ao remover geocerca');
    }
  }

  const count = geofences?.length ?? 0;

  return (
    <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--bg-border)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🗺</span>
          <span className="text-xs font-semibold t-text-lo">
            Geocercas {geofences !== null ? `(${count})` : ''}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">

          {/* Existing geofences */}
          {geofences === null ? (
            <div className="flex justify-center py-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : geofences.length === 0 && !showForm ? (
            <p className="text-xs t-text-lo text-center italic py-1">
              Nenhuma geocerca configurada
            </p>
          ) : (
            geofences.map(g => {
              const r = parseRadius(g.area);
              return (
                <div key={g.id} className="flex items-center justify-between rounded-lg px-2.5 py-2"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--bg-border)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold t-text-hi truncate">{g.name}</p>
                    {r != null && <p className="text-xs t-text-lo">{fmtRadius(r)} de raio</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(g)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                    style={{ background: 'rgba(255,59,48,0.1)' }}
                    title="Excluir geocerca"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
              );
            })
          )}

          {/* New geofence form */}
          {showForm ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-page)', border: '1px solid var(--bg-border)' }}>
              <div>
                <label className="block text-xs t-text-lo mb-1">Nome da cerca</label>
                <input
                  type="text"
                  placeholder="Ex: Garagem, Empresa"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs t-text-lo mb-1">Endereço do centro da cerca</label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista, 1000, São Paulo"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs t-text-lo mb-1.5">Raio</label>
                <div className="flex flex-wrap gap-1">
                  {RADIUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setForm(p => ({ ...p, radius: opt.value }))}
                      className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
                      style={{
                        background: form.radius === opt.value ? '#007AFF' : 'var(--bg-card)',
                        color:      form.radius === opt.value ? 'white' : 'var(--text-lo)',
                        border:     `1px solid ${form.radius === opt.value ? '#007AFF' : 'var(--bg-border)'}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowForm(false); setForm({ name: '', address: '', radius: 500 }); }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold t-text-lo"
                  style={{ background: 'var(--bg-border)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || !form.address.trim()}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: '#007AFF' }}
                >
                  {geocoding ? 'Localizando...' : saving ? 'Criando...' : 'Criar cerca'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-1.5 rounded-lg text-xs font-semibold text-center"
              style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF', border: '1px dashed rgba(0,122,255,0.3)' }}
            >
              + Nova geocerca
            </button>
          )}
        </div>
      )}
    </div>
  );
}
