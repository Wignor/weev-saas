'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import PushNotificationSetup from '@/components/PushNotificationSetup';
import GeofenceModal from '@/components/GeofenceModal';
import FaturaModal from '@/components/FaturaModal';
import ContratoModal from '@/components/ContratoModal';
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
  movendo: '#34C759', parado: '#007AFF', offline: '#6B7280', expirado: '#FF3B30',
};
const S_BG: Record<DeviceStatus, string> = {
  movendo: 'rgba(52,199,89,0.15)', parado: 'rgba(0,122,255,0.15)',
  offline: 'rgba(107,114,128,0.15)', expirado: 'rgba(255,59,48,0.15)',
};

function detectVehicleType(name: string): string {
  const n = name.toLowerCase();
  if (/moto|scooter|cg\s|titan|bros|fazer|factor|biz|pop\s|nxr|xre|twister|lead|pcx|burgman/.test(n)) return 'motorcycle';
  if (/caminhao|caminhão|truck|carreta|bitruck|scania|volvo fh|iveco|daf\s/.test(n)) return 'truck';
  if (/onibus|ônibus|\bbus\b|micro.?onibus|micro.?ônibus|sprinter|kombi/.test(n)) return 'bus';
  if (/pickup|caminhonete|hilux|ranger|\bs10\b|l200|triton|frontier|amarok|f-250|f250|\btoro\b|oroch/.test(n)) return 'pickup';
  if (/barco|lancha|embarcacao|embarcação|ferry|bote/.test(n)) return 'boat';
  return 'car';
}
const S_LABEL: Record<DeviceStatus, string> = {
  movendo: 'Movendo', parado: 'Parado', offline: 'Offline', expirado: 'Expirado',
};

const VEHICLE_TYPES = [
  { type: 'car',        label: 'Carro',      emoji: '🚗' },
  { type: 'motorcycle', label: 'Moto',       emoji: '🏍️' },
  { type: 'truck',      label: 'Caminhão',   emoji: '🚚' },
  { type: 'bus',        label: 'Ônibus',     emoji: '🚌' },
  { type: 'pickup',     label: 'Caminhonete', emoji: '🚙' },
  { type: 'universal',  label: 'Universal',  emoji: '📍' },
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
  { key: 'geofenceExit', icon: '🚧', label: 'Cerca virtual',          desc: 'Notificar quando o veículo sair da área configurada' },
] as const;

type BoolPrefKey = 'ignitionOn' | 'ignitionOff' | 'moving' | 'overspeed' | 'parking' | 'lowBattery' | 'sos' | 'collision' | 'geofenceExit' | 'notifSound' | 'notifVibrate';
type NotifPrefs = Record<BoolPrefKey, boolean> & { speedLimit: number };
const DEFAULT_PREFS: NotifPrefs = {
  ignitionOn: true, ignitionOff: true, moving: false, overspeed: false,
  parking: false, lowBattery: false, sos: true, collision: true, geofenceExit: true, speedLimit: 100,
  notifSound: true, notifVibrate: true,
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
  onGeofence?: () => void;
  clientName?: string;
  isAdmin?: boolean;
  variant?: 'sheet' | 'panel';
  licenseInfo?: { daysLeft: number; status: string };
}

function DeviceDetail({ device, pos, onClose, onHistory, onCenter, onGeofence, clientName, isAdmin, variant = 'sheet', licenseInfo }: DeviceDetailProps) {
  const [cmdLoading, setCmdLoading] = useState<string | null>(null);
  const [cmdMsg, setCmdMsg] = useState('');
  const [confirmCmd, setConfirmCmd] = useState<{ type: string; label: string } | null>(null);
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

          {/* Modo de entrega */}
          <p className="text-xs font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: 'var(--text-lo)' }}>Modo de entrega</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bg-border)' }}>
            {([
              { key: 'notifSound' as BoolPrefKey, icon: '🔊', label: 'Som', desc: 'Toca um som ao receber o alerta' },
              { key: 'notifVibrate' as BoolPrefKey, icon: '📳', label: 'Vibração', desc: 'Vibra o dispositivo ao receber o alerta' },
            ]).map((item, i) => (
              <div key={item.key} className="flex items-center gap-3 px-3 py-3"
                style={{ background: i === 0 ? 'var(--bg-input)' : 'transparent', borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>{item.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-lo)' }}>{item.desc}</p>
                </div>
                <button onClick={() => togglePref(item.key)}
                  className="flex-shrink-0 w-12 h-6 rounded-full transition-all relative"
                  style={{ background: prefs[item.key] ? '#34C759' : 'var(--bg-border)' }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: prefs[item.key] ? '26px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
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
          <button onClick={() => setConfirmCmd({ type: 'engineStop', label: 'Bloquear' })} disabled={!!cmdLoading}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.2)', minWidth: '68px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="font-medium" style={{ color: '#FF3B30', fontSize: '10px' }}>{cmdLoading === 'engineStop' ? '...' : 'Bloquear'}</span>
          </button>
        )}
        {canControl && (
          <button onClick={() => setConfirmCmd({ type: 'engineResume', label: 'Desbloquear' })} disabled={!!cmdLoading}
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
        {onGeofence && (
          <button onClick={onGeofence}
            className="flex flex-col items-center gap-1 rounded-xl py-2 flex-shrink-0"
            style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', minWidth: '68px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="3"/>
            </svg>
            <span className="font-medium" style={{ color: '#FF3B30', fontSize: '10px' }}>Cerca</span>
          </button>
        )}
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
          ...(licenseInfo ? [{ label: 'Licença', value: licenseInfo.status === 'expired' ? 'Expirada' : licenseInfo.daysLeft <= 7 ? `Expira em ${licenseInfo.daysLeft}d` : `${licenseInfo.daysLeft}d restantes`, valueColor: licenseInfo.status === 'expired' ? '#FF3B30' : licenseInfo.daysLeft <= 7 ? '#FF9500' : '#34C759' }] : []),
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2"
            style={{ background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
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

      {/* Confirmation popup for block/unblock */}
      {confirmCmd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9900, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-hi)', textAlign: 'center', marginBottom: 8 }}>
              {confirmCmd.type === 'engineStop' ? '🔒 Confirmar Bloqueio' : '🔓 Confirmar Desbloqueio'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', textAlign: 'center', marginBottom: 16 }}>
              Enviar <strong>{confirmCmd.label}</strong> para <strong>{deviceName}</strong>?
            </p>
            {speed > 20 && confirmCmd.type === 'engineStop' && (
              <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#FF3B30', fontWeight: 700 }}>⚠️ Veículo em movimento: {speed} km/h</p>
                <p style={{ fontSize: 11, color: '#FF3B30', marginTop: 4, opacity: 0.8 }}>Bloqueio recomendado abaixo de 20 km/h</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmCmd(null)}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: 'var(--bg-input)', color: 'var(--text-lo)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { sendCommand(confirmCmd.type, confirmCmd.label); setConfirmCmd(null); }}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                  background: confirmCmd.type === 'engineStop' ? '#FF3B30' : '#34C759',
                  color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {confirmCmd.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── VehicleIcon SVG — iOPGPS style (filled body + mirrors, no wheels) ── */
function VehicleIcon({ type, color }: { type: string; color: string }) {
  const ws = 'rgba(0,0,0,0.22)'; // windshield tint
  switch (type) {
    case 'motorcycle': return (
      <svg width="14" height="26" viewBox="0 0 14 26" fill="none">
        <ellipse cx="7" cy="5" rx="5.5" ry="4.5" fill={color}/>
        <rect x="3.5" y="8.5" width="7" height="9" rx="3.5" fill={color}/>
        <ellipse cx="7" cy="21" rx="5.5" ry="4.5" fill={color}/>
        <ellipse cx="7" cy="5" rx="2.5" ry="2" fill={ws}/>
        <path d="M0.5 5 H13.5" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    );
    case 'truck': return (
      <svg width="18" height="28" viewBox="0 0 18 28" fill="none">
        <path d="M4 3 Q4 1 9 0.5 Q14 1 14 3 L14 11 Q14 13 9 13.5 Q4 13 4 11 Z" fill={color}/>
        <path d="M5.5 3.5 Q6 2 9 1.5 Q12 2 12.5 3.5 L13 7 L5 7 Z" fill={ws}/>
        <rect x="0.5" y="4" width="4" height="6" rx="1.5" fill={color}/>
        <rect x="13.5" y="4" width="4" height="6" rx="1.5" fill={color}/>
        <rect x="4" y="14" width="10" height="14" rx="1.5" fill={color}/>
      </svg>
    );
    case 'bus': return (
      <svg width="16" height="30" viewBox="0 0 16 30" fill="none">
        <rect x="2" y="1" width="12" height="28" rx="3.5" fill={color}/>
        <path d="M3.5 2 Q4 1.2 8 1 Q12 1.2 12.5 2 L12.5 6 L3.5 6 Z" fill={ws}/>
        <rect x="3.5" y="8.5" width="3.5" height="2.5" rx="0.5" fill={ws}/>
        <rect x="9" y="8.5" width="3.5" height="2.5" rx="0.5" fill={ws}/>
        <rect x="3.5" y="13.5" width="3.5" height="2.5" rx="0.5" fill={ws}/>
        <rect x="9" y="13.5" width="3.5" height="2.5" rx="0.5" fill={ws}/>
        <path d="M3.5 27.5 Q4 29.5 8 30 Q12 29.5 12.5 27.5 L12.5 24.5 L3.5 24.5 Z" fill={ws}/>
        <rect x="-0.5" y="3" width="3.5" height="5" rx="1.2" fill={color}/>
        <rect x="13" y="3" width="3.5" height="5" rx="1.2" fill={color}/>
      </svg>
    );
    case 'pickup': return (
      <svg width="18" height="28" viewBox="0 0 18 28" fill="none">
        <path d="M4 3 Q4 1 9 0.5 Q14 1 14 3 L14 14 Q14 16 9 16.5 Q4 16 4 14 Z" fill={color}/>
        <path d="M5.5 3.5 Q6 2 9 1.5 Q12 2 12.5 3.5 L13 7.5 L5 7.5 Z" fill={ws}/>
        <rect x="0.5" y="4.5" width="4" height="6.5" rx="1.5" fill={color}/>
        <rect x="13.5" y="4.5" width="4" height="6.5" rx="1.5" fill={color}/>
        <rect x="4" y="17" width="10" height="11" rx="1.5" fill={color}/>
      </svg>
    );
    case 'universal': return (
      <svg width="16" height="22" viewBox="0 0 16 22" fill="none">
        <path d="M8 1C4.13 1 1 4.13 1 8C1 13.25 8 21 8 21C8 21 15 13.25 15 8C15 4.13 11.87 1 8 1Z" fill={color}/>
        <circle cx="8" cy="8" r="3" fill="rgba(0,0,0,0.25)"/>
        <circle cx="8" cy="8" r="1.5" fill="rgba(255,255,255,0.55)"/>
      </svg>
    );
    default: return ( // car — iOPGPS: rounded body, windshields, side mirrors, no wheels
      <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
        <path d="M3.5 5 Q3.5 2.5 9 2 Q14.5 2.5 14.5 5 L14.5 22 Q14.5 24.5 9 25 Q3.5 24.5 3.5 22 Z" fill={color}/>
        <path d="M5 5.5 Q5.5 3.5 9 3 Q12.5 3.5 13 5.5 L13.5 9.5 L4.5 9.5 Z" fill={ws}/>
        <path d="M5 20.5 Q5.5 23 9 23.5 Q12.5 23 13 20.5 L13.5 17 L4.5 17 Z" fill={ws}/>
        <rect x="0.5" y="6.5" width="3.5" height="5.5" rx="1.2" fill={color}/>
        <rect x="14" y="6.5" width="3.5" height="5.5" rx="1.2" fill={color}/>
      </svg>
    );
  }
}

/* ── DeviceListItem ── */
interface ListItemProps {
  device: TraccarDevice;
  pos?: TraccarPosition;
  isSelected: boolean;
  clientName: string;
  vehicleType?: string;
  licenseStatus?: string;
  onSelect: () => void;
  onMenu: () => void;
}

function DeviceListItem({ device, pos, isSelected, clientName, vehicleType, licenseStatus, onSelect, onMenu }: ListItemProps) {
  const status: DeviceStatus = licenseStatus === 'expired' ? 'expirado' : getStatus(device, pos);
  const speed = pos ? knotsToKmh(pos.speed) : 0;
  const isOffline = status === 'offline' || status === 'expirado';
  const effectiveType = vehicleType || detectVehicleType(device.name);
  const iconColor = isOffline ? 'var(--text-lo)' : S_COLOR[status];
  const fixTime = pos?.fixTime
    ? new Date(pos.fixTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const stateAge = isOffline
    ? timeOffline(device.lastUpdate)
    : pos?.fixTime ? fmtDuration(pos.fixTime) : null;

  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px 8px 0',
      background: isSelected ? 'var(--bg-hover)' : 'transparent',
      borderBottom: '1px solid var(--bg-border)',
      borderLeft: `3px solid ${S_COLOR[status]}`,
      paddingLeft: '11px',
      cursor: 'pointer',
      transition: 'background 0.15s',
    }}>

      {/* Circular vehicle icon */}
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%',
        background: isOffline ? 'var(--bg-input)' : `${S_COLOR[status]}18`,
        border: `2px solid ${isOffline ? 'var(--bg-border)' : S_COLOR[status]}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <VehicleIcon type={effectiveType} color={iconColor} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '2px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {device.name}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: S_COLOR[status], flexShrink: 0 }}>
            {S_LABEL[status]}
          </span>
        </div>
        {/* Row 2: speed / state age + client */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
          {speed > 2 && <span style={{ fontSize: '11px', fontWeight: 700, color: S_COLOR[status] }}>{speed} km/h</span>}
          {stateAge && <span style={{ fontSize: '10px', color: 'var(--text-lo)' }}>há {stateAge}</span>}
          {fixTime && !isOffline && <span style={{ fontSize: '10px', color: 'var(--text-lo)' }}>· {fixTime}</span>}
          {clientName && <span style={{ fontSize: '10px', color: 'var(--text-lo)' }}>· {clientName}</span>}
        </div>
        {/* Row 3: full IMEI */}
        <span style={{ fontSize: '9.5px', color: 'var(--text-lo)', fontFamily: 'monospace', opacity: 0.6, letterSpacing: '0.02em' }}>
          {device.uniqueId}
        </span>
      </div>

      {/* Three-dots */}
      <button onClick={e => { e.stopPropagation(); onMenu(); }}
        style={{ width: '26px', height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 0 }}>
        <svg width="4" height="16" viewBox="0 0 4 16" fill="var(--text-lo)">
          <circle cx="2" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/>
        </svg>
      </button>
    </div>
  );
}

type UserEntry = { id: number; name: string; email: string; phone?: string; attributes?: { cpfCnpj?: string }; role: string };

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
  const [listCollapsed, setListCollapsed] = useState(false);
  const [vehiclePrefs, setVehiclePrefs] = useState<Record<number, DevicePref>>({});
  const [menuDeviceId, setMenuDeviceId] = useState<number | null>(null);
  const [infoDeviceId, setInfoDeviceId] = useState<number | null>(null);
  const [licenses, setLicenses] = useState<Record<string, { daysLeft: number; status: string }>>({});
  const [geofenceDeviceId, setGeofenceDeviceId] = useState<number | null>(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersList, setUsersList] = useState<UserEntry[]>([]);
  const [profileUser, setProfileUser] = useState<UserEntry | null>(null);
  const [faturaProfileUser, setFaturaProfileUser] = useState<UserEntry | null>(null);
  const [contratoProfileUser, setContratoProfileUser] = useState<UserEntry | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [allDevices, setAllDevices] = useState<TraccarDevice[]>([]);
  const [allPositions, setAllPositions] = useState<TraccarPosition[]>([]);
  const [mergeFetching, setMergeFetching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveTrailRef = useRef<Map<number, [number, number][]>>(new Map());
  const prevPosRef = useRef<Map<number, [number, number]>>(new Map());
  const [liveTrail, setLiveTrail] = useState<Map<number, [number, number][]>>(new Map());
  const mergeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

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
    if (user.administrator && !asUser) {
      fetch('/api/admin/users').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setUsersList(data.filter((u: { administrator?: boolean }) => !u.administrator));
      }).catch(() => {});
    }
  }, [user.administrator, asUser]);

  useEffect(() => {
    fetch('/api/devices/prefs').then(r => r.json()).then((data: Record<string, DevicePref>) => {
      if (data && typeof data === 'object') {
        const mapped: Record<number, DevicePref> = {};
        for (const [id, pref] of Object.entries(data)) mapped[Number(id)] = pref;
        setVehiclePrefs(mapped);
      }
    }).catch(() => {});
    fetch('/api/licenses').then(r => r.json()).then(data => {
      if (data && typeof data === 'object') setLicenses(data);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const suffix = asUser ? `?asUser=${asUser}` : '';
      const [devRes, posRes] = await Promise.all([fetch(`/api/devices${suffix}`), fetch(`/api/positions${suffix}`)]);
      if (devRes.status === 401) { window.location.href = '/login'; return; }
      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(posData)) {
        setPositions(posData);
        let changed = false;
        for (const pos of posData as TraccarPosition[]) {
          if (!pos.valid || (pos.latitude === 0 && pos.longitude === 0)) continue;
          const prev = prevPosRef.current.get(pos.deviceId);
          if (!prev || Math.abs(prev[0] - pos.latitude) > 0.000005 || Math.abs(prev[1] - pos.longitude) > 0.000005) {
            prevPosRef.current.set(pos.deviceId, [pos.latitude, pos.longitude]);
            const existing = liveTrailRef.current.get(pos.deviceId) || [];
            liveTrailRef.current.set(pos.deviceId, [...existing, [pos.latitude, pos.longitude] as [number, number]].slice(-500));
            changed = true;
          }
        }
        if (changed) setLiveTrail(new Map(liveTrailRef.current));
      }
      setLastUpdate(new Date());
    } catch { /**/ }
    finally { setLoading(false); }
  }, [asUser]);

  useEffect(() => {
    liveTrailRef.current.clear();
    prevPosRef.current.clear();
    setLiveTrail(new Map());
    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  async function fetchAllFleet() {
    setMergeFetching(true);
    try {
      const [devRes, posRes] = await Promise.all([
        fetch('/api/admin/all-devices'),
        fetch('/api/admin/all-positions'),
      ]);
      if (devRes.ok) setAllDevices(await devRes.json());
      if (posRes.ok) setAllPositions(await posRes.json());
    } catch { /**/ } finally { setMergeFetching(false); }
  }

  useEffect(() => {
    if (mergeMode) {
      fetchAllFleet();
      mergeIntervalRef.current = setInterval(fetchAllFleet, 3000);
    } else {
      if (mergeIntervalRef.current) clearInterval(mergeIntervalRef.current);
      setAllDevices([]);
      setAllPositions([]);
    }
    return () => { if (mergeIntervalRef.current) clearInterval(mergeIntervalRef.current); };
  }, [mergeMode]);

  const displayDevices = mergeMode ? allDevices : devices;
  const displayPositions = mergeMode ? allPositions : positions;
  const posMap = useMemo(() => Object.fromEntries(displayPositions.map((p) => [p.deviceId, p])), [displayPositions]);
  const selectedDevice = useMemo(() => displayDevices.find((d) => d.id === selectedId), [displayDevices, selectedId]);
  const mapVehiclePrefs: Record<number, string> = useMemo(() => Object.fromEntries(
    displayDevices.map(d => [d.id, vehiclePrefs[d.id]?.vehicleType || detectVehicleType(d.name)])
  ), [displayDevices, vehiclePrefs]);

  function getEffectiveStatus(device: TraccarDevice, pos?: TraccarPosition): DeviceStatus {
    const lic = licenses[String(device.id)];
    if (lic?.status === 'expired') return 'expirado';
    return getStatus(device, pos);
  }

  const countByStatus = {
    online: displayDevices.filter(d => { const s = getEffectiveStatus(d, posMap[d.id]); return s === 'movendo' || s === 'parado'; }).length,
    offline: displayDevices.filter(d => getEffectiveStatus(d, posMap[d.id]) === 'offline').length,
    expirando: displayDevices.filter(d => getEffectiveStatus(d, posMap[d.id]) === 'expirado').length,
  };

  const filteredDevices = displayDevices.filter(d => {
    const st = getEffectiveStatus(d, posMap[d.id]);
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
    { key: 'expirando', label: 'Expirado', count: countByStatus.expirando },
  ];

  function selectDevice(id: number) {
    const device = displayDevices.find(d => d.id === id);
    if (device && !user.administrator) {
      const st = getEffectiveStatus(device, posMap[device.id]);
      if (st === 'expirado') {
        alert('⚠️ Licença expirada. Entre em contato com o suporte para regularizar o pagamento e reativar o rastreamento.');
        return;
      }
    }
    setSelectedId(id);
    setMobileView('mapa');
    setPanelMinimized(false);
    setDesktopPanelCollapsed(false);
  }

  function closeDetailMobile() {
    setPanelMinimized(true);
  }

  const [usersSearch, setUsersSearch] = useState('');
  const sortedUsersList = [...usersList].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const filteredUsersList = sortedUsersList.filter(u =>
    !usersSearch || u.name.toLowerCase().includes(usersSearch.toLowerCase()) || u.email.toLowerCase().includes(usersSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col sidebar-offset" style={{ height: '100dvh', background: 'var(--bg-page)' }}>
      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-20"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-2">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                <path d="M7 1C4.24 1 2 3.24 2 6C2 9.75 7 17.5 7 17.5C7 17.5 12 9.75 12 6C12 3.24 9.76 1 7 1Z" fill="white"/>
                <circle cx="7" cy="6" r="2" fill="#007AFF"/>
              </svg>
            </div>
            <span className="font-bold text-base" style={{ color: 'var(--text-hi)' }}>WeevTrack</span>
          </div>
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
            <>
              {user.administrator && (
                <button onClick={() => setShowUsersModal(true)}
                  className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{ background: 'rgba(0,122,255,0.12)', color: '#007AFF', border: '1px solid rgba(0,122,255,0.2)' }}
                  title="Acessar conta de usuário">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Usuários
                </button>
              )}
              <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-border)' }} title="Alternar tema">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </button>
            </>
          )}
          {lastUpdate && (
            <span className="text-xs hidden md:block" style={{ color: 'var(--text-lo)' }}>
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>

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
          style={{ width: listCollapsed ? 44 : 280, borderRight: '1px solid var(--bg-border)', background: 'var(--bg-page)', transition: 'width 0.2s ease' }}>
          <button
            onClick={() => setListCollapsed(c => !c)}
            title={listCollapsed ? 'Expandir lista' : 'Recolher lista'}
            style={{
              height: 44, display: 'flex', alignItems: 'center', flexShrink: 0,
              justifyContent: listCollapsed ? 'center' : 'flex-end',
              padding: listCollapsed ? 0 : '0 12px',
              borderBottom: '1px solid var(--bg-border)',
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
              {listCollapsed
                ? <polyline points="9 18 15 12 9 6"/>
                : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
          {!listCollapsed && (
            <>
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
                {user.administrator && !asUser && (
                  <button onClick={() => setMergeMode(m => !m)}
                    className="w-full mt-2 text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: mergeMode ? 'rgba(255,149,0,0.15)' : 'var(--bg-input)',
                      color: mergeMode ? '#FF9500' : 'var(--text-lo)',
                      border: mergeMode ? '1px solid rgba(255,149,0,0.3)' : '1px solid transparent',
                    }}>
                    🌐 {mergeMode ? `Frota total (${displayDevices.length})` : 'Frota total — todos clientes'}
                  </button>
                )}
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
                    licenseStatus={licenses[String(device.id)]?.status}
                    onSelect={() => { const nid = selectedId === device.id ? null : device.id; setSelectedId(nid); if (nid) setDesktopPanelCollapsed(false); }}
                    onMenu={() => setMenuDeviceId(device.id)} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Map — zIndex:0 creates stacking context, trapping Leaflet internals (z 200-700)
            so the list overlay (z:10) and BottomNav (fixed z:50) appear correctly above */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, zIndex: 0 }}>
          <VehicleMap
            devices={displayDevices} positions={displayPositions}
            selectedDeviceId={selectedId}
            onDeviceSelect={(id) => selectDevice(id)}
            visible={mobileView === 'mapa'}
            centerTrigger={centerTrigger}
            vehiclePrefs={mapVehiclePrefs}
            liveTrail={liveTrail}
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
                onGeofence={() => setGeofenceDeviceId(selectedId)}
                clientName={assignments[selectedId]} isAdmin={user.administrator}
                licenseInfo={licenses[String(selectedId)]}
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
              onGeofence={() => setGeofenceDeviceId(selectedId)}
              clientName={assignments[selectedId]} isAdmin={user.administrator}
              licenseInfo={licenses[String(selectedId)]}
              variant="panel" />
          </div>
        )}

        {/* Mobile list overlay — sits over map in lista view */}
        <div
          className={`md:hidden ${mobileView === 'lista' ? 'flex' : 'hidden'}`}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10,
            background: 'var(--bg-page)',
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
              {user.administrator && !asUser && (
                <button onClick={() => setMergeMode(m => !m)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{
                    background: mergeMode ? 'rgba(255,149,0,0.15)' : 'var(--bg-input)',
                    color: mergeMode ? '#FF9500' : 'var(--text-lo)',
                    whiteSpace: 'nowrap',
                    border: mergeMode ? '1px solid rgba(255,149,0,0.3)' : '1px solid transparent',
                  }}>
                  🌐 {mergeMode ? 'Frota total' : 'Frota total'}
                </button>
              )}
            </div>
          </div>
          {/* Pull-to-refresh + List */}
          <div className="flex-1 overflow-y-auto pb-20" ref={mobileListRef}
            onTouchStart={e => { pullStartY.current = e.touches[0].clientY; }}
            onTouchMove={e => {
              if ((mobileListRef.current?.scrollTop ?? 1) > 0) return;
              const dy = e.touches[0].clientY - pullStartY.current;
              if (dy > 0) setPullDistance(Math.min(dy * 0.5, 60));
            }}
            onTouchEnd={() => {
              if (pullDistance >= 55) fetchData();
              setPullDistance(0);
            }}>
            {pullDistance > 0 && (
              <div className="ptr-indicator" style={{ height: pullDistance }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round"
                  style={{ transform: pullDistance >= 55 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </div>
            )}
            {(loading || (mergeMode && mergeFetching)) ? (
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
                licenseStatus={licenses[String(device.id)]?.status}
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

      {geofenceDeviceId !== null && (() => {
        const gfDevice = devices.find(d => d.id === geofenceDeviceId);
        return gfDevice ? (
          <GeofenceModal
            deviceId={geofenceDeviceId}
            deviceName={gfDevice.name}
            lat={posMap[geofenceDeviceId]?.latitude}
            lon={posMap[geofenceDeviceId]?.longitude}
            onClose={() => setGeofenceDeviceId(null)}
          />
        ) : null;
      })()}

      {showUsersModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowUsersModal(false); }}>
          <div style={{ width: '100%', maxWidth: '400px', borderRadius: '20px', overflow: 'hidden', background: 'var(--bg-card)', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-hi)' }}>Acessar conta de usuário</span>
              </div>
              <button onClick={() => setShowUsersModal(false)}
                style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', border: 'none', cursor: 'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: '10px 20px 8px' }}>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '10px', border: '1px solid var(--bg-border)', background: 'var(--bg-input)', color: 'var(--text-hi)', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-lo)' }}>Clique para visualizar como o cliente, ou 👤 para ver o cadastro.</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '80px' }}>
              {filteredUsersList.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-lo)', padding: '32px' }}>Nenhum cliente encontrado</p>
              ) : filteredUsersList.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderBottom: '1px solid var(--bg-border)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,122,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#007AFF' }}>{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <a href={`/dashboard?asUser=${u.id}&asUserName=${encodeURIComponent(u.name)}`}
                    style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
                    onClick={() => setShowUsersModal(false)}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-hi)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-lo)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                  </a>
                  <button onClick={() => { setProfileUser(u); setShowUsersModal(false); }}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.2)', cursor: 'pointer' }}
                    title="Ver cadastro">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Client profile modal ── */}
      {profileUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setProfileUser(null); }}>
          <div style={{ width: '100%', maxWidth: '420px', borderRadius: '20px', overflow: 'hidden', background: 'var(--bg-card)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,149,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: '18px', color: '#FF9500' }}>{profileUser.name.charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-hi)', margin: 0 }}>{profileUser.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-lo)', margin: 0 }}>Cadastro do cliente</p>
              </div>
              <button onClick={() => setProfileUser(null)}
                style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-input)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {/* Fields */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {[
                { label: 'Nome completo', value: profileUser.name },
                { label: 'E-mail', value: profileUser.email },
                { label: 'Telefone', value: profileUser.phone || '—' },
                { label: 'CPF / CNPJ', value: profileUser.attributes?.cpfCnpj || '—' },
                { label: 'Função', value: profileUser.role === 'admin' ? 'Administrador' : profileUser.role === 'distribuidor' ? 'Distribuidor' : profileUser.role === 'distribuidor_geral' ? 'Distribuidor Geral' : profileUser.role === 'monitor' ? 'Monitor' : 'Usuário' },
                { label: 'ID Traccar', value: String(profileUser.id) },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent', borderBottom: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-lo)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-hi)', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
                </div>
              ))}
            </div>
            {/* Actions */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={`/dashboard?asUser=${profileUser.id}&asUserName=${encodeURIComponent(profileUser.name)}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(0,122,255,0.12)', color: '#007AFF', fontWeight: 600, fontSize: '13px', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Ver como cliente
                </a>
                <a href={`/gestao?tab=usuarios&highlight=${profileUser.id}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(255,149,0,0.12)', color: '#FF9500', fontWeight: 600, fontSize: '13px', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar
                </a>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setProfileUser(null); setContratoProfileUser(profileUser); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(0,122,255,0.08)', color: '#007AFF', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(0,122,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  📄 Contrato
                </button>
                <button onClick={() => { setProfileUser(null); setFaturaProfileUser(profileUser); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(52,199,89,0.08)', color: '#34C759', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(52,199,89,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  💰 Financeiro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {faturaProfileUser && (
        <FaturaModal user={faturaProfileUser} onClose={() => setFaturaProfileUser(null)} />
      )}
      {contratoProfileUser && (
        <ContratoModal user={contratoProfileUser} onClose={() => setContratoProfileUser(null)} />
      )}

      <BottomNav />
    </div>
  );
}
