'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import PushNotificationSetup from '@/components/PushNotificationSetup';
import { TraccarDevice, TraccarPosition, knotsToKmh } from '@/lib/traccar';

const VehicleMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find((r) => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', administrator: false }; }
}

function timeOffline(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  return `${mins}m`;
}

function fmtDuration(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${sec}s`;
  return `${sec}s`;
}

function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

type DeviceStatus = 'movendo' | 'parado' | 'offline' | 'expirado';
type DevicePref = { vehicleType: string; chipNumber?: string; iccid?: string };

function getStatus(device: TraccarDevice, pos?: TraccarPosition): DeviceStatus {
  if (device.status === 'online') {
    if (pos && knotsToKmh(pos.speed) > 2) return 'movendo';
    return 'parado';
  }
  if (device.lastUpdate) {
    if ((Date.now() - new Date(device.lastUpdate).getTime()) / 86400000 > 7) return 'expirado';
  }
  return 'offline';
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

const S_COLOR: Record<DeviceStatus, string> = {
  movendo: '#34C759', parado: '#FF9500', offline: '#6B7280', expirado: '#FF3B30',
};
const S_BG: Record<DeviceStatus, string> = {
  movendo: 'rgba(52,199,89,0.15)', parado: 'rgba(255,149,0,0.15)',
  offline: 'rgba(107,114,128,0.15)', expirado: 'rgba(255,59,48,0.15)',
};
const S_LABEL: Record<DeviceStatus, string> = {
  movendo: 'Movendo', parado: 'Estático', offline: 'Offline', expirado: 'Expirado',
};

const VEHICLE_TYPES = [
  { type: 'car',        label: 'Carro',     emoji: '🚗' },
  { type: 'motorcycle', label: 'Moto',      emoji: '🏍️' },
  { type: 'truck',      label: 'Caminhão',  emoji: '🚚' },
  { type: 'bus',        label: 'Ônibus',    emoji: '🚌' },
  { type: 'pickup',     label: 'Caminhonete', emoji: '🚙' },
  { type: 'boat',       label: 'Barco',     emoji: '⛵' },
];

const NOTIF_ITEMS = [
  { key: 'ignitionOn',  icon: '🔑', label: 'Motor ligado',           desc: 'Notificar quando o veículo for ligado' },
  { key: 'ignitionOff', icon: '🔒', label: 'Motor desligado',        desc: 'Notificar quando o veículo for desligado' },
  { key: 'moving',      icon: '🚗', label: 'Movimento',              desc: 'Veículo começou a se mover ou parou' },
  { key: 'overspeed',   icon: '🚦', label: 'Excesso de velocidade',  desc: 'Velocidade acima do limite configurado' },
  { key: 'parking',     icon: '🅿️', label: 'Estacionamento',         desc: 'Veículo parado no mesmo local por +5 min' },
  { key: 'lowBattery',  icon: '🔋', label: 'Bateria do aparelho',    desc: 'Bateria interna do rastreador está fraca' },
  { key: 'sos',         icon: '🆘', label: 'Botão de pânico (SOS)',  desc: 'Alerta quando o botão SOS for acionado' },
  { key: 'collision',   icon: '💥', label: 'Colisão / vibração',     desc: 'Impacto ou vibração forte detectado' },
] as const;

type BoolPrefKey = 'ignitionOn' | 'ignitionOff' | 'moving' | 'overspeed' | 'parking' | 'lowBattery' | 'sos' | 'collision';
type NotifPrefs = Record<BoolPrefKey, boolean> & { speedLimit: number };
const DEFAULT_PREFS: NotifPrefs = {
  ignitionOn: true, ignitionOff: true, moving: false, overspeed: false,
  parking: false, lowBattery: false, sos: true, collision: true, speedLimit: 100,
};

/* ── DeviceInfoSheet ── */
function DeviceInfoSheet({ device, pos, currentPrefs, onClose, onSave }: {
  device: TraccarDevice; pos?: TraccarPosition; currentPrefs: DevicePref;
  onClose: () => void; onSave: (deviceId: number, prefs: DevicePref) => void;
}) {
  const [selectedType, setSelectedType] = useState(currentPrefs.vehicleType || 'car');
  const [chipNumber, setChipNumber] = useState(currentPrefs.chipNumber || '');
  const [iccid, setIccid] = useState(currentPrefs.iccid || '');
  const [saving, setSaving] = useState(false);
  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const battery = pos?.attributes?.batteryLevel as number | undefined;
  const voltage = pos?.attributes?.power as number | undefined;

  async function save() {
    setSaving(true);
    const prefs: DevicePref = { vehicleType: selectedType, chipNumber: chipNumber.trim(), iccid: iccid.trim() };
    await fetch('/api/devices/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, ...prefs }) }).catch(() => {});
    onSave(device.id, prefs);
    setSaving(false);
    onClose();
  }

  const rows = [
    { label: 'IMEI', value: device.uniqueId },
    { label: 'Status', value: S_LABEL[status] },
    { label: 'Último contato', value: fmtDateTime(device.lastUpdate) },
    { label: 'Velocidade', value: `${speed} km/h` },
    ...(battery !== undefined ? [{ label: 'Bateria', value: `${battery}%` }] : []),
    ...(voltage !== undefined ? [{ label: 'Tensão', value: `${(voltage as number).toFixed(1)}V` }] : []),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="font-bold text-base flex-1 truncate" style={{ color: 'var(--text-hi)' }}>{device.name}</h2>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: S_BG[status], color: S_COLOR[status] }}>{S_LABEL[status]}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-lo)' }}>Informações técnicas</p>
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--bg-border)' }}>
          {rows.map((row, i) => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2.5"
              style={{ background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: i < rows.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
              <span className="text-xs" style={{ color: 'var(--text-lo)' }}>{row.label}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-mid)' }}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-lo)' }}>Informações do chip</p>
        <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--bg-border)' }}>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-lo)', minWidth: '72px' }}>Nº do chip</span>
            <input value={chipNumber} onChange={e => setChipNumber(e.target.value)} placeholder="Ex: 11987654321"
              className="flex-1 text-xs font-mono font-semibold text-right focus:outline-none bg-transparent"
              style={{ color: 'var(--text-mid)', minWidth: 0 }} />
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-lo)', minWidth: '72px' }}>ICCID</span>
            <input value={iccid} onChange={e => setIccid(e.target.value)} placeholder="Ex: 89550..."
              className="flex-1 text-xs font-mono font-semibold text-right focus:outline-none bg-transparent"
              style={{ color: 'var(--text-mid)', minWidth: 0 }} />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-lo)' }}>Tipo de veículo</p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-lo)' }}>O ícone aparecerá no mapa e na lista de veículos.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {VEHICLE_TYPES.map(vt => (
            <button key={vt.type} onClick={() => setSelectedType(vt.type)}
              className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all"
              style={{ background: selectedType === vt.type ? 'rgba(0,122,255,0.15)' : 'var(--bg-input)', border: `2px solid ${selectedType === vt.type ? '#007AFF' : 'transparent'}` }}>
              <span className="text-2xl">{vt.emoji}</span>
              <span className="text-xs font-semibold" style={{ color: selectedType === vt.type ? '#007AFF' : 'var(--text-mid)' }}>{vt.label}</span>
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60" style={{ background: '#007AFF', color: 'white' }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

/* ── ActionSheet ── */
function ActionSheet({ device, onClose, onSelect, onInfo }: { device: TraccarDevice; onClose: () => void; onSelect: () => void; onInfo: () => void; }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '16px', boxShadow: '0 -8px 32px rgba(0,0,0,0.4)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--bg-border)' }} />
        <p className="font-bold text-base text-center mb-4 truncate px-8" style={{ color: 'var(--text-hi)' }}>{device.name}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([
            { icon: '🗺️', label: 'Rastrear no mapa', action: () => { onSelect(); onClose(); } },
            { icon: '🛣️', label: 'Ver trajetos', action: () => { window.location.href = `/historico?device=${device.id}`; } },
            { icon: 'ℹ️', label: 'Informações do veículo', action: () => { onInfo(); onClose(); } },
          ] as const).map(a => (
            <button key={a.label} onClick={a.action} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left" style={{ background: 'var(--bg-input)' }}>
              <span className="text-xl flex-shrink-0">{a.icon}</span>
              <span className="font-medium text-sm" style={{ color: 'var(--text-hi)' }}>{a.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 rounded-xl font-semibold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-lo)' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ── DeviceDetail ── */
interface DeviceDetailProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  onClose: () => void;
  onHistory: () => void;
  onCenter?: () => void;
  clientName?: string;
  isAdmin?: boolean;
  variant?: 'sheet' | 'panel';
}

function DeviceDetail({ device, pos, onClose, onHistory, onCenter, clientName, isAdmin, variant = 'sheet' }: DeviceDetailProps) {
  const [cmdLoading, setCmdLoading] = useState<string | null>(null);
  const [cmdMsg, setCmdMsg] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(device.name);
  const [deviceName, setDeviceName] = useState(device.name);
  const [resolvedAddress, setResolvedAddress] = useState('Carregando endereço...');
  const [notifView, setNotifView] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!pos) { setResolvedAddress('Sem posição disponível'); return; }
    setResolvedAddress('Carregando endereço...');
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.latitude}&lon=${pos.longitude}&format=json`)
      .then(r => r.json())
      .then(d => setResolvedAddress(d.display_name || 'Endereço não disponível'))
      .catch(() => setResolvedAddress('Endereço não disponível'));
  }, [pos?.latitude, pos?.longitude]);

  useEffect(() => {
    fetch('/api/push/preferences').then(r => r.json()).then(d => { if (!d.error) setPrefs(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) { setPushEnabled(false); return; }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false));
  }, []);

  async function activatePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushEnabled(false); return; }
      const { key } = await fetch('/api/push/vapid-public').then(r => r.json());
      const padding = '='.repeat((4 - (key.length % 4)) % 4);
      const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = window.atob(base64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes.buffer as ArrayBuffer });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      setPushEnabled(true);
    } catch { setPushEnabled(false); }
  }

  async function togglePref(key: BoolPrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsLoading(true);
    await fetch('/api/push/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    setPrefsLoading(false);
  }

  async function saveSpeedLimit(value: number) {
    const limit = Math.max(30, Math.min(300, value || 100));
    const next = { ...prefs, speedLimit: limit };
    setPrefs(next);
    setPrefsLoading(true);
    await fetch('/api/push/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    setPrefsLoading(false);
  }

  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const ignition = pos?.attributes?.ignition;
  const battery = pos?.attributes?.batteryLevel as number | undefined;
  const voltage = pos?.attributes?.power as number | undefined;
  const totalDist = pos?.attributes?.totalDistance as number | undefined;
  const odometerKm = totalDist !== undefined ? Math.round(totalDist / 1000).toLocaleString('pt-BR') + ' km' : '—';
  const voltageStr = voltage !== undefined ? `${voltage.toFixed(1)}V` : '—';
  const powerSource = voltage !== undefined ? (voltage > 10 ? 'Com fio' : 'Bateria') : battery !== undefined ? 'Bateria' : '—';
  const statusSince = pos?.deviceTime || device.lastUpdate;
  const canControl = !clientName || isAdmin;

  async function sendCommand(type: string, label: string) {
    setCmdLoading(type); setCmdMsg('');
    try {
      const res = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, type }) });
      const data = await res.json();
      setCmdMsg(res.ok ? `✅ ${label} enviado` : `❌ ${data.error || 'Falha'}`);
    } catch { setCmdMsg('❌ Erro de conexão'); }
    finally { setCmdLoading(null); setTimeout(() => setCmdMsg(''), 4000); }
  }

  async function doRename() {
    if (!renameVal.trim() || renameVal.trim() === deviceName) { setRenaming(false); return; }
    try {
      const res = await fetch('/api/admin/devices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, name: renameVal.trim() }) });
      if (res.ok) { setDeviceName(renameVal.trim()); setCmdMsg('✅ Renomeado'); }
      else { setCmdMsg('❌ Erro ao renomear'); }
    } catch { setCmdMsg('❌ Erro de conexão'); }
    setRenaming(false); setTimeout(() => setCmdMsg(''), 3000);
  }

  function shareLocation() {
    if (!pos) return;
    const url = `https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`;
    if (navigator.share) { navigator.share({ title: deviceName, text: `Localização de ${deviceName}`, url }); }
    else { navigator.clipboard.writeText(url); setCmdMsg('✅ Link copiado!'); setTimeout(() => setCmdMsg(''), 3000); }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', paddingBottom: variant === 'sheet' ? '1.5rem' : '16px' }}>
      {variant === 'sheet' && <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--bg-border)' }} />}

      {/* Notif settings view */}
      {notifView && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setNotifView(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h3 className="font-bold text-base flex-1" style={{ color: 'var(--text-hi)' }}>Notificações</h3>
            {prefsLoading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-lo)' }}>Configurações aplicadas a todos os seus veículos.</p>
          {pushEnabled === false && (
            <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-3" style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}>
              <span className="text-lg flex-shrink-0">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>Push inativo</p>
                <p className="text-xs" style={{ color: 'var(--text-lo)' }}>Ative para receber alertas neste dispositivo</p>
              </div>
              <button onClick={activatePush} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#FF9500', color: 'white' }}>
                Ativar
              </button>
            </div>
          )}
          {pushEnabled === true && (
            <div className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2" style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.15)' }}>
              <span className="text-sm">✅</span>
              <p className="text-xs" style={{ color: '#34C759' }}>Push ativo neste dispositivo</p>
            </div>
          )}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bg-border)' }}>
            {NOTIF_ITEMS.map((item, i) => (
              <Fragment key={item.key}>
                <div className="flex items-center gap-3 px-3 py-3"
                  style={{ background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: '1px solid var(--bg-border)' }}>
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>{item.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-lo)' }}>{item.desc}</p>
                  </div>
                  <button onClick={() => togglePref(item.key as BoolPrefKey)}
                    className="flex-shrink-0 w-12 h-6 rounded-full transition-all relative"
                    style={{ background: prefs[item.key as BoolPrefKey] ? '#34C759' : 'var(--bg-border)' }}>
                    <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{ left: prefs[item.key as BoolPrefKey] ? '26px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
                {item.key === 'overspeed' && (
                  <div className="flex items-center justify-between px-3 py-2.5"
                    style={{ background: 'rgba(255,149,0,0.06)', borderBottom: '1px solid var(--bg-border)' }}>
                    <div className="flex items-center gap-2 ml-7">
                      <span className="text-xs" style={{ color: 'var(--text-lo)' }}>Limite de velocidade</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="30" max="300"
                        value={prefs.speedLimit ?? 100}
                        onChange={e => setPrefs(p => ({ ...p, speedLimit: Number(e.target.value) }))}
                        onBlur={e => saveSpeedLimit(Number(e.target.value))}
                        className="w-16 text-xs text-center rounded-lg px-2 py-1 focus:outline-none"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-lo)' }}>km/h</span>
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Device info view */}
      {!notifView && <>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
                className="flex-1 rounded-lg px-2 py-1 text-base font-bold focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid #007AFF' }} />
              <button onClick={doRename} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,199,89,0.15)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button onClick={() => setRenaming(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,59,48,0.1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base truncate" style={{ color: 'var(--text-hi)' }}>{deviceName}</h2>
              {isAdmin && (
                <button onClick={() => { setRenameVal(deviceName); setRenaming(true); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,122,255,0.1)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-lo)' }}>{device.uniqueId}</p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-border)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: S_BG[status], color: S_COLOR[status] }}>
            {S_LABEL[status]}{statusSince ? ` ${fmtDuration(statusSince)}` : ''}
          </span>
        </div>
      </div>

      {cmdMsg && (
        <p className="text-xs text-center mb-3 font-medium py-2 rounded-lg"
          style={{ background: cmdMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: cmdMsg.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
          {cmdMsg}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {onCenter && (
          <button onClick={onCenter} disabled={!pos}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0 disabled:opacity-40"
            style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)', minWidth: '68px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#007AFF', fontSize: '10px' }}>Rastrear</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => sendCommand('engineStop', 'Bloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)', minWidth: '68px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="font-medium" style={{ color: '#FF3B30', fontSize: '10px' }}>{cmdLoading === 'engineStop' ? '...' : 'Bloquear'}</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => sendCommand('engineResume', 'Desbloqueio')} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '68px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              <polyline points="16 5 19 8 22 5"/>
            </svg>
            <span className="font-medium" style={{ color: '#34C759', fontSize: '10px' }}>{cmdLoading === 'engineResume' ? '...' : 'Desbloquear'}</span>
          </button>
        )}
        <button onClick={shareLocation} disabled={!pos}
          className="flex flex-col items-center gap-1 rounded-xl py-2 disabled:opacity-40 flex-shrink-0"
          style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.15)', minWidth: '68px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span className="font-medium" style={{ color: '#007AFF', fontSize: '10px' }}>Compartilhar</span>
        </button>
        <button onClick={() => setNotifView(true)}
          className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0"
          style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', minWidth: '68px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="font-medium" style={{ color: '#34C759', fontSize: '10px' }}>Notificações</span>
        </button>
      </div>

      {/* Address */}
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2" style={{ background: 'var(--bg-input)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        </svg>
        <p className="flex-1 text-xs leading-relaxed" style={{ color: resolvedAddress && resolvedAddress !== 'Carregando endereço...' ? 'var(--text-mid)' : 'var(--text-lo)' }}>
          {resolvedAddress}
        </p>
        {pos && (
          <button onClick={() => window.open(`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`, '_blank')}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1"
            style={{ background: 'rgba(0,122,255,0.15)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}
      </div>

      {/* Info table */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--bg-border)' }}>
        {[
          { label: 'Servidor', value: fmtDateTime(pos?.serverTime) },
          { label: 'GPS Fix', value: fmtDateTime(pos?.fixTime) },
          { label: `Fonte · ${powerSource}`, value: voltageStr, valueColor: voltage ? (voltage > 11 ? '#34C759' : '#FF9500') : undefined },
          { label: 'Ignição', value: ignition === true ? 'Ligada' : ignition === false ? `Desligada ${fmtDuration(statusSince)}` : '—', valueColor: ignition === true ? '#34C759' : ignition === false ? '#FF3B30' : undefined },
          { label: 'Odômetro', value: odometerKm },
          { label: 'Velocidade', value: `${speed} km/h`, valueColor: speed > 0 ? '#007AFF' : undefined },
        ].map((item, i) => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2"
            style={{ background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: i < 5 ? '1px solid var(--bg-border)' : 'none' }}>
            <span className="text-xs" style={{ color: 'var(--text-lo)' }}>{item.label}</span>
            <span className="text-xs font-semibold" style={{ color: item.valueColor || 'var(--text-mid)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {clientName && (
        <div className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2"
          style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)' }}>
          <span>👤</span>
          <p className="text-xs" style={{ color: 'var(--text-mid)' }}>Cliente: <span className="font-semibold" style={{ color: '#FF9500' }}>{clientName}</span></p>
        </div>
      )}

      {pos && <p className="text-xs text-center mt-1" style={{ color: 'var(--text-lo)' }}>{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}</p>}
      </>}
    </div>
  );
}

/* ── DeviceListItem ── */
interface ListItemProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  isSelected: boolean;
  clientName: string;
  vehicleType?: string;
  onSelect: () => void;
  onMenu: () => void;
}

function DeviceListItem({ device, pos, isSelected, clientName, vehicleType, onSelect, onMenu }: ListItemProps) {
  const status = getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const isOffline = status === 'offline' || status === 'expirado';
  const offlineTag = isOffline ? timeOffline(device.lastUpdate) : null;

  return (
    <div onClick={onSelect} className="w-full text-left px-4 py-3 transition-all cursor-pointer"
      style={{ background: isSelected ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--bg-border)' }}>
      <div className="flex items-center gap-3">

        {/* Avatar column */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: '52px' }}>
          <div className="relative">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
              style={{ background: isSelected ? 'rgba(0,122,255,0.2)' : S_BG[status] }}>
              {VEHICLE_TYPES.find(v => v.type === (vehicleType || 'car'))?.emoji ?? '🚗'}
            </div>
            {/* Signal dot */}
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full"
              style={{ background: S_COLOR[status], border: '2.5px solid var(--bg-page)' }} />
          </div>
          {offlineTag && (
            <span className="mt-1 font-semibold text-center px-1.5 py-0.5 rounded"
              style={{ background: S_BG[status], color: S_COLOR[status], fontSize: '9px', lineHeight: '1.2' }}>
              {offlineTag}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-hi)' }}>{device.name}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: clientName ? 'rgba(255,149,0,0.15)' : S_BG[status], color: clientName ? '#FF9500' : S_COLOR[status] }}>
              {clientName ? `👤 ${clientName}` : S_LABEL[status]}
            </span>
          </div>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-lo)' }}>{device.uniqueId.slice(-12)}</p>
          {speed > 0 && <p className="text-xs mt-0.5" style={{ color: '#007AFF' }}>⚡ {speed} km/h</p>}
        </div>

        {/* Three-dots */}
        <button onClick={e => { e.stopPropagation(); onMenu(); }}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center"
          style={{ background: 'transparent', opacity: 0.6 }}>
          <svg width="4" height="18" viewBox="0 0 4 18" fill="var(--text-lo)">
            <circle cx="2" cy="2" r="2"/><circle cx="2" cy="9" r="2"/><circle cx="2" cy="16" r="2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function DashboardPage() {
  const [asUser, setAsUser] = useState<string | null>(null);
  const [asUserName, setAsUserName] = useState<string | null>(null);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<'lista' | 'mapa'>('lista');
  const [filter, setFilter] = useState<'todos' | 'online' | 'offline' | 'expirando'>('todos');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState({ name: '', administrator: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [desktopPanelCollapsed, setDesktopPanelCollapsed] = useState(false);
  const [vehiclePrefs, setVehiclePrefs] = useState<Record<number, DevicePref>>({});
  const [menuDeviceId, setMenuDeviceId] = useState<number | null>(null);
  const [infoDeviceId, setInfoDeviceId] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setAsUser(p.get('asUser'));
    setAsUserName(p.get('asUserName'));
  }, []);

  useEffect(() => {
    const u = getUserFromCookie();
    setUser(u);
    if (u.administrator && !asUser) {
      fetch('/api/admin/assignments').then(r => r.json()).then(data => {
        if (data && typeof data === 'object') setAssignments(data);
      }).catch(() => {});
    }
  }, [asUser]);

  useEffect(() => {
    fetch('/api/devices/prefs').then(r => r.json()).then((data: Record<string, DevicePref>) => {
      if (data && typeof data === 'object') {
        const mapped: Record<number, DevicePref> = {};
        for (const [id, pref] of Object.entries(data)) mapped[Number(id)] = pref;
        setVehiclePrefs(mapped);
      }
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const suffix = asUser ? `?asUser=${asUser}` : '';
      const [devRes, posRes] = await Promise.all([fetch(`/api/devices${suffix}`), fetch(`/api/positions${suffix}`)]);
      if (devRes.status === 401) { window.location.href = '/login'; return; }
      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) setPositions(posData);
      setLastUpdate(new Date());
    } catch { /**/ }
    finally { setLoading(false); }
  }, [asUser]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));
  const selectedDevice = devices.find((d) => d.id === selectedId);
  const mapVehiclePrefs: Record<number, string> = Object.fromEntries(
    Object.entries(vehiclePrefs).map(([k, v]) => [Number(k), v.vehicleType])
  );

  const countByStatus = {
    online: devices.filter(d => { const s = getStatus(d, posMap[d.id]); return s === 'movendo' || s === 'parado'; }).length,
    offline: devices.filter(d => getStatus(d, posMap[d.id]) === 'offline').length,
    expirando: devices.filter(d => getStatus(d, posMap[d.id]) === 'expirado').length,
  };

  const filteredDevices = devices.filter(d => {
    const st = getStatus(d, posMap[d.id]);
    if (filter === 'online' && st !== 'movendo' && st !== 'parado') return false;
    if (filter === 'offline' && st !== 'offline') return false;
    if (filter === 'expirando' && st !== 'expirado') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.uniqueId.includes(search)) return false;
    return true;
  });

  const filterTabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: devices.length },
    { key: 'online', label: 'Online', count: countByStatus.online },
    { key: 'offline', label: 'Offline', count: countByStatus.offline },
    { key: 'expirando', label: 'Expirando', count: countByStatus.expirando },
  ];

  function selectDevice(id: number) {
    setSelectedId(id);
    setMobileView('mapa');
    setPanelMinimized(false);
    setDesktopPanelCollapsed(false);
  }

  function closeDetailMobile() {
    setPanelMinimized(true);
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-20"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" fill="white"/>
              <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--text-hi)' }}>WeevTrack</span>
          {asUserName && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>
              👤 {asUserName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}>
            {countByStatus.online} online
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(107,114,128,0.15)', color: '#6B7280' }}>
            {countByStatus.offline + countByStatus.expirando} offline
          </span>
          {asUser ? (
            <a href="/dashboard" className="text-xs px-2.5 py-1 rounded-lg font-medium no-underline"
              style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>✕ Sair</a>
          ) : (
            <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-border)' }} title="Alternar tema">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>
          )}
          {lastUpdate && (
            <span className="text-xs hidden md:block" style={{ color: 'var(--text-lo)' }}>
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* ── Desktop nav tabs ── */}
      <div className="hidden md:flex flex-shrink-0 px-4 gap-1"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', paddingTop: '6px', paddingBottom: '6px' }}>
        {[
          { href: '/dashboard', label: 'Monitor' },
          { href: '/historico', label: 'Trajetos' },
          { href: '/alertas', label: 'Alertas' },
          ...(user.administrator ? [{ href: '/gestao', label: 'Gestão' }] : []),
          { href: '/perfil', label: 'Perfil' },
        ].map(tab => {
          const active = typeof window !== 'undefined' && window.location.pathname === tab.href;
          return (
            <a key={tab.href} href={tab.href}
              className="px-4 py-1.5 rounded-lg text-sm font-medium no-underline transition-all"
              style={{ background: active ? '#007AFF' : 'transparent', color: active ? 'white' : 'var(--text-lo)' }}>
              {tab.label}
            </a>
          );
        })}
        {lastUpdate && (
          <span className="ml-auto text-xs self-center" style={{ color: 'var(--text-lo)' }}>
            Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Mobile toggle: Lista / Mapa ── */}
      <div className="md:hidden flex-shrink-0 flex px-4 py-2 gap-2"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {(['lista', 'mapa'] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: mobileView === v ? '#007AFF' : 'transparent', color: mobileView === v ? 'white' : 'var(--text-lo)' }}>
            {v === 'lista' ? 'Lista' : 'Mapa'}
          </button>
        ))}
        {lastUpdate && (
          <span className="text-xs self-center ml-1" style={{ color: 'var(--text-lo)' }}>
            {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <PushNotificationSetup />

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden" style={{ position: 'relative', minHeight: 0 }}>

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col flex-none overflow-hidden"
          style={{ width: '280px', borderRight: '1px solid var(--bg-border)', background: 'var(--bg-page)' }}>
          <div className="flex-shrink-0 p-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {filterTabs.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="flex-1 text-xs py-1 rounded-lg font-medium transition-all"
                  style={{ background: filter === f.key ? '#007AFF' : 'var(--bg-input)', color: filter === f.key ? 'white' : 'var(--text-lo)', minWidth: '48px' }}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-12 px-6">
                <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p>
              </div>
            ) : filteredDevices.map(device => (
              <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                vehicleType={vehiclePrefs[device.id]?.vehicleType}
                onSelect={() => { const nid = selectedId === device.id ? null : device.id; setSelectedId(nid); if (nid) setDesktopPanelCollapsed(false); }}
                onMenu={() => setMenuDeviceId(device.id)} />
            ))}
          </div>
        </div>

        {/* Map — zIndex:0 creates stacking context, trapping Leaflet internals (z 200-700)
            so the list overlay (z:10) and BottomNav (fixed z:50) appear correctly above */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, zIndex: 0 }}>
          <VehicleMap
            devices={devices} positions={positions}
            selectedDeviceId={selectedId}
            onDeviceSelect={(id) => selectDevice(id)}
            visible={mobileView === 'mapa'}
            centerTrigger={centerTrigger}
            vehiclePrefs={mapVehiclePrefs}
          />

          {/* Mobile — barra minimizada */}
          {selectedId && selectedDevice && mobileView === 'mapa' && panelMinimized && (() => {
            const st = getStatus(selectedDevice, posMap[selectedId]);
            return (
              <div className="md:hidden flex items-center gap-3 px-4" style={{
                position: 'absolute', bottom: '64px', left: 0, right: 0,
                zIndex: 800, height: '52px',
                background: 'var(--bg-card)',
                borderRadius: '16px 16px 0 0',
                borderTop: '2px solid var(--bg-border)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
              }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: S_BG[st] }}>
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                    <path d="M10 30L12 22H36L38 30H10Z" fill={S_COLOR[st]}/>
                    <circle cx="17" cy="32" r="3.5" fill={S_COLOR[st]}/>
                    <circle cx="31" cy="32" r="3.5" fill={S_COLOR[st]}/>
                  </svg>
                </div>
                <span className="flex-1 font-semibold text-sm truncate" style={{ color: 'var(--text-hi)' }}>{selectedDevice.name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: S_BG[st], color: S_COLOR[st] }}>{S_LABEL[st]}</span>
                <button onClick={() => setPanelMinimized(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bg-border)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
              </div>
            );
          })()}

          {/* Mobile — painel expandido */}
          {selectedId && selectedDevice && mobileView === 'mapa' && !panelMinimized && (
            <div className="md:hidden flex flex-col" style={{
              position: 'absolute', bottom: '64px', left: 0, right: 0,
              zIndex: 800,
              background: 'var(--bg-card)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '55%',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
            }}>
              <DeviceDetail
                device={selectedDevice} pos={posMap[selectedId]}
                onClose={closeDetailMobile}
                onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
                onCenter={() => setCenterTrigger(t => t + 1)}
                clientName={assignments[selectedId]} isAdmin={user.administrator}
                variant="sheet"
              />
            </div>
          )}
        </div>

        {/* Desktop detail panel — collapsed tab */}
        {selectedId && selectedDevice && desktopPanelCollapsed && (() => {
          const st = getStatus(selectedDevice, posMap[selectedId]);
          return (
            <div className="hidden md:flex flex-col flex-none items-center py-3 gap-3 cursor-pointer"
              style={{ width: '40px', borderLeft: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}
              onClick={() => setDesktopPanelCollapsed(false)}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </div>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '160px', overflow: 'hidden', flex: 1 }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-hi)', whiteSpace: 'nowrap' }}>{selectedDevice.name}</span>
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: S_COLOR[st] }} />
            </div>
          );
        })()}

        {/* Desktop detail panel — expanded */}
        {selectedId && selectedDevice && !desktopPanelCollapsed && (
          <div className="hidden md:flex flex-col flex-none overflow-hidden"
            style={{ width: '360px', borderLeft: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
            <DeviceDetail device={selectedDevice} pos={posMap[selectedId]}
              onClose={() => setDesktopPanelCollapsed(true)}
              onHistory={() => { window.location.href = `/historico?device=${selectedId}`; }}
              onCenter={() => setCenterTrigger(t => t + 1)}
              clientName={assignments[selectedId]} isAdmin={user.administrator} variant="panel" />
          </div>
        )}

        {/* Mobile list overlay — sits over map in lista view */}
        <div className="md:hidden" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 10,
          background: 'var(--bg-page)',
          display: mobileView === 'lista' ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search & filters */}
          <div className="flex-shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {filterTabs.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ background: filter === f.key ? '#007AFF' : 'var(--bg-input)', color: filter === f.key ? 'white' : 'var(--text-lo)', whiteSpace: 'nowrap' }}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <p className="text-sm" style={{ color: 'var(--text-lo)' }}>Nenhum dispositivo</p>
              </div>
            ) : filteredDevices.map(device => (
              <DeviceListItem key={device.id} device={device} pos={posMap[device.id]}
                isSelected={selectedId === device.id} clientName={assignments[device.id] || ''}
                vehicleType={vehiclePrefs[device.id]?.vehicleType}
                onSelect={() => selectDevice(device.id)}
                onMenu={() => setMenuDeviceId(device.id)} />
            ))}
          </div>
        </div>
      </div>

      {menuDeviceId !== null && (() => {
        const md = devices.find(d => d.id === menuDeviceId);
        return md ? (
          <ActionSheet device={md} onClose={() => setMenuDeviceId(null)}
            onSelect={() => { selectDevice(md.id); setMenuDeviceId(null); }}
            onInfo={() => { setInfoDeviceId(md.id); setMenuDeviceId(null); }} />
        ) : null;
      })()}

      {infoDeviceId !== null && (() => {
        const id = devices.find(d => d.id === infoDeviceId);
        return id ? (
          <DeviceInfoSheet device={id} pos={posMap[infoDeviceId]}
            currentPrefs={vehiclePrefs[infoDeviceId] || { vehicleType: 'car' }}
            onClose={() => setInfoDeviceId(null)}
            onSave={(deviceId, prefs) => setVehiclePrefs(prev => ({ ...prev, [deviceId]: prefs }))} />
        ) : null;
      })()}

      <BottomNav />
    </div>
  );
}
