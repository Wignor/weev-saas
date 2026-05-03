'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import ContratoModal from '@/components/ContratoModal';
import GeofenceSection from '@/components/GeofenceSection';

type TClient = { id: number; name: string; email: string; phone?: string; };
type TDevice = { id: number; name: string; uniqueId: string; status: string; };
type TLicInfo = { expiresAt: string; daysLeft: number; status: string };
type TMyDevice = TDevice & { lastUpdate: string; license: TLicInfo | null };

function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', role: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', role: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', role: '', administrator: false }; }
}

function statusColor(status: string) {
  return status === 'online' ? '#34C759' : '#808080';
}

export default function DistribuidorPage() {
  const router = useRouter();
  const [user, setUser] = useState({ name: '', role: '', administrator: false });
  const [clients, setClients] = useState<TClient[]>([]);
  const [clientDevices, setClientDevices] = useState<Record<number, TDevice[]>>({});
  const [selectedClient, setSelectedClient] = useState<TClient | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', password: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [contratoUser, setContratoUser] = useState<TClient | null>(null);
  const [activeTab, setActiveTab] = useState<'clientes' | 'dispositivos'>('clientes');
  const [allDevices, setAllDevices] = useState<TDevice[]>([]);
  const [credits, setCredits] = useState(0);
  const [licenses, setLicenses] = useState<Record<string, TLicInfo>>({});
  const [ownDevices, setOwnDevices] = useState<TMyDevice[]>([]);
  const [ownDevicesLoading, setOwnDevicesLoading] = useState(true);

  useEffect(() => {
    const u = getUserFromCookie();
    if (u.administrator) { router.replace('/gestao'); return; }
    if (u.role !== 'distribuidor' && u.role !== 'distribuidor_geral') {
      router.replace('/dashboard'); return;
    }
    setUser(u);
    loadClients();
    loadLicenses();
    loadMyDevices();
  }, []);

  async function loadLicenses() {
    try {
      const res = await fetch('/api/distribuidor/licenses');
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits ?? 0);
        setLicenses(data.licenses ?? {});
      }
    } catch { /* silencioso */ }
  }

  async function loadMyDevices() {
    setOwnDevicesLoading(true);
    try {
      const res = await fetch('/api/distribuidor/my-devices');
      if (res.ok) {
        const data = await res.json();
        setOwnDevices(Array.isArray(data.devices) ? data.devices : []);
      }
    } catch { /* silencioso */ }
    setOwnDevicesLoading(false);
  }

  async function activateMyLicense(deviceId: number) {
    const res = await fetch('/api/distribuidor/my-devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const data = await res.json();
    if (res.ok) {
      setCredits(data.credits);
      setOwnDevices(prev => prev.map(d => d.id === deviceId
        ? { ...d, license: { expiresAt: data.expiresAt, daysLeft: data.daysLeft, status: data.status } }
        : d
      ));
      flash(`✅ Licença ativada — expira em ${data.daysLeft} dias`);
    } else {
      flash(`❌ ${data.error || 'Erro ao ativar licença'}`);
    }
  }

  async function loadClients() {
    setLoading(true);
    try {
      const res = await fetch('/api/distribuidor/clients');
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) setClients(data);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  async function loadAllDevices() {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (Array.isArray(data)) setAllDevices(data);
    } catch { /* silencioso */ }
  }

  async function selectClient(client: TClient) {
    if (selectedClient?.id === client.id) { setSelectedClient(null); return; }
    setSelectedClient(client);
    if (!clientDevices[client.id]) {
      setLoadingDevices(true);
      try {
        const res = await fetch(`/api/distribuidor/clients/${client.id}/devices`);
        const data = await res.json();
        setClientDevices(prev => ({ ...prev, [client.id]: Array.isArray(data) ? data : [] }));
      } catch { setClientDevices(prev => ({ ...prev, [client.id]: [] })); }
      setLoadingDevices(false);
    }
    if (allDevices.length === 0) loadAllDevices();
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3500); }

  async function createClient() {
    if (!newClient.name || !newClient.email || !newClient.password) return;
    setCreating(true);
    try {
      const res = await fetch('/api/distribuidor/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        flash('✅ Cliente criado com sucesso');
        setNewClient({ name: '', email: '', password: '', phone: '' });
        setShowCreate(false);
        await loadClients();
      } else {
        const err = await res.json();
        flash(`❌ ${err.error || 'Erro ao criar'}`);
      }
    } catch { flash('❌ Erro de conexão'); }
    setCreating(false);
  }

  async function assignDevice(clientId: number, deviceId: number) {
    const res = await fetch(`/api/distribuidor/clients/${clientId}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      const dev = allDevices.find(d => d.id === deviceId);
      if (dev) setClientDevices(prev => ({ ...prev, [clientId]: [...(prev[clientId] || []), dev] }));
      flash('✅ Dispositivo atribuído');
    } else flash('❌ Erro ao atribuir');
  }

  async function removeDevice(clientId: number, deviceId: number) {
    const res = await fetch(`/api/distribuidor/clients/${clientId}/devices`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      setClientDevices(prev => ({ ...prev, [clientId]: (prev[clientId] || []).filter(d => d.id !== deviceId) }));
      flash('✅ Dispositivo removido');
    } else flash('❌ Erro ao remover');
  }

  async function activateLicense(deviceId: number, clientId: number) {
    const res = await fetch('/api/distribuidor/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, clientId }),
    });
    const data = await res.json();
    if (res.ok) {
      setCredits(data.credits);
      setLicenses(prev => ({
        ...prev,
        [String(deviceId)]: { expiresAt: data.expiresAt, daysLeft: data.daysLeft, status: data.status },
      }));
      flash(`✅ Licença ativada — expira em ${data.daysLeft} dias`);
    } else {
      flash(`❌ ${data.error || 'Erro ao ativar licença'}`);
    }
  }

  const [listCollapsed, setListCollapsed] = useState(false);

  const assignedIds = Object.values(clientDevices).flat().map(d => d.id);
  const unassigned = allDevices.filter(d => !assignedIds.includes(d.id));
  const selectedClientDevices = selectedClient ? (clientDevices[selectedClient.id] || []) : [];
  const online = clients.filter(c => {
    const devs = clientDevices[c.id] || [];
    return devs.some(d => d.status === 'online');
  }).length;

  const detailPanel = selectedClient ? (
    <div>
      {loadingDevices ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider mb-3">
            Atribuídos a {selectedClient.name} ({selectedClientDevices.length})
          </p>
          {selectedClientDevices.length === 0 ? (
            <p className="text-xs t-text-lo mb-4 text-center py-2">Nenhum dispositivo atribuído</p>
          ) : (
            <div className="space-y-2 mb-4">
              {selectedClientDevices.map(device => {
                const lic = licenses[String(device.id)];
                const licColor = !lic ? '#6B7280' : lic.status === 'expired' ? '#FF3B30' : lic.status === 'expiring' ? '#FF9500' : '#34C759';
                const licLabel = !lic ? 'Sem licença' : lic.status === 'expired' ? 'Expirado' : `${lic.daysLeft}d`;
                return (
                  <div key={device.id} className="rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(device.status) }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium t-text-hi truncate">{device.name}</p>
                          <p className="text-xs t-text-lo">{device.uniqueId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: `${licColor}18`, color: licColor }}>
                          {licLabel}
                        </span>
                        <button onClick={() => activateLicense(device.id, selectedClient.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: credits > 0 ? 'rgba(139,92,246,0.12)' : 'rgba(107,114,128,0.1)', color: credits > 0 ? '#8B5CF6' : '#6B7280' }}
                          title={credits > 0 ? 'Ativar/Renovar (+31 dias)' : 'Sem créditos disponíveis'}>
                          +31d
                        </button>
                        <button onClick={() => removeDevice(selectedClient.id, device.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>
                          Remover
                        </button>
                      </div>
                    </div>
                    <GeofenceSection
                      deviceId={device.id}
                      clientId={selectedClient.id}
                      apiBase="/api/distribuidor/geofences"
                      onMessage={flash}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {unassigned.length > 0 && (
            <>
              <p className="text-xs font-semibold t-text-lo uppercase tracking-wider mb-3">
                Disponíveis para atribuir
              </p>
              <div className="space-y-2">
                {unassigned.map(device => (
                  <div key={device.id} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor(device.status) }} />
                      <div>
                        <p className="text-sm font-medium t-text-hi">{device.name}</p>
                        <p className="text-xs t-text-lo">{device.uniqueId}</p>
                      </div>
                    </div>
                    <button onClick={() => assignDevice(selectedClient.id, device.id)}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: 'rgba(0,122,255,0.15)', color: '#007AFF' }}>
                      Atribuir
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button onClick={() => setContratoUser(selectedClient)}
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF', border: '1px solid rgba(0,122,255,0.2)' }}>
            📄 Contrato
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="sidebar-offset flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 no-underline"
            style={{ background: 'var(--bg-border)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </a>
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.2)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm t-text-hi leading-tight">Meu Painel</h1>
            {user.name && <p className="text-xs" style={{ color: '#8B5CF6', lineHeight: 1 }}>{user.name.split(' ')[0]}</p>}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
          + Novo cliente
        </button>
      </header>

      {/* Stats */}
      <div className="flex-shrink-0 flex"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {[
          { value: clients.length, label: 'Clientes', color: 'var(--text-hi)' },
          { value: Object.values(clientDevices).flat().length, label: 'Dispositivos', color: '#007AFF' },
          { value: online, label: 'Online', color: '#34C759' },
          { value: credits, label: 'Créditos', color: credits === 0 ? '#FF3B30' : credits <= 3 ? '#FF9500' : '#8B5CF6' },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex-1 flex flex-col items-center py-3"
            style={{ borderRight: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
            <span className="font-bold text-xl" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs t-text-lo mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {msg && (
        <div className="mx-4 mt-3 rounded-xl px-4 py-2 text-sm text-center font-medium"
          style={{
            background: msg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
            color: msg.startsWith('✅') ? '#34C759' : '#FF3B30',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)'}`,
          }}>
          {msg}
        </div>
      )}

      {/* Meus Dispositivos */}
      {(ownDevicesLoading || ownDevices.length > 0) && (
        <div className="flex-shrink-0 mx-4 mt-3 rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--bg-border)', background: 'rgba(0,122,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                <rect x="1" y="3" width="15" height="13" rx="2"/>
                <path d="M16 8h5l2 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <p className="text-xs font-bold" style={{ color: '#007AFF' }}>Meus Dispositivos</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
              {ownDevices.length}
            </span>
          </div>
          {ownDevicesLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : ownDevices.map((dev, i) => {
            const lic = dev.license;
            const licColor = !lic ? '#6B7280' : lic.status === 'expired' ? '#FF3B30' : lic.status === 'expiring' ? '#FF9500' : '#34C759';
            const licLabel = !lic ? 'Sem licença' : lic.status === 'expired' ? 'Expirado' : lic.status === 'expiring' ? `${lic.daysLeft}d` : `${lic.daysLeft}d`;
            return (
              <div key={dev.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: dev.status === 'online' ? '#34C759' : '#6B7280' }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t-text-hi truncate">{dev.name}</p>
                  <p className="text-xs t-text-lo">{dev.uniqueId.slice(-8)}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                  style={{ background: `${licColor}18`, color: licColor }}>
                  {licLabel}
                </span>
                <button onClick={() => activateMyLicense(dev.id)}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                  style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
                  +31d
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: client list */}
        <div className="flex flex-col flex-none overflow-hidden"
          style={{ width: listCollapsed ? 44 : 320, borderRight: '1px solid var(--bg-border)', background: 'var(--bg-page)', transition: 'width 0.2s ease', flexShrink: 0 }}>
          <button onClick={() => setListCollapsed(c => !c)}
            title={listCollapsed ? 'Expandir lista' : 'Recolher lista'}
            style={{ height: 44, display: 'flex', alignItems: 'center', flexShrink: 0, justifyContent: listCollapsed ? 'center' : 'flex-end', padding: listCollapsed ? 0 : '0 12px', borderBottom: '1px solid var(--bg-border)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
              {listCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
          {!listCollapsed && (
            <div className="flex-1 overflow-y-auto pb-24">
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-16 px-8">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="t-text-lo text-sm">Nenhum cliente ainda</p>
                  <p className="t-text-lo text-xs mt-1">Toque em "+ Novo cliente" para adicionar</p>
                </div>
              ) : (
                <div className="mt-2" style={{ borderTop: '1px solid var(--bg-border)' }}>
                  {clients.map(client => {
                    const isOpen = selectedClient?.id === client.id;
                    const devs = clientDevices[client.id] || [];
                    const hasOnline = devs.some(d => d.status === 'online');
                    return (
                      <div key={client.id}>
                        <div className="flex items-center gap-3 px-4 py-3"
                          style={{ background: isOpen ? 'rgba(139,92,246,0.08)' : 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(139,92,246,0.13)' }}>
                            <span className="font-bold text-sm" style={{ color: '#8B5CF6' }}>
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <button className="flex-1 text-left min-w-0" onClick={() => selectClient(client)}>
                            <p className="text-sm font-semibold t-text-hi truncate">{client.name}</p>
                            <p className="text-xs t-text-lo truncate">{client.email}</p>
                          </button>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {devs.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{
                                  background: hasOnline ? 'rgba(52,199,89,0.12)' : 'rgba(107,114,128,0.12)',
                                  color: hasOnline ? '#34C759' : '#808080',
                                }}>
                                {devs.length} disp.
                              </span>
                            )}
                            <button onClick={() => selectClient(client)}
                              className="text-xs px-2.5 py-1 rounded-lg font-medium"
                              style={{
                                background: isOpen ? '#8B5CF6' : 'var(--bg-border)',
                                color: isOpen ? 'white' : 'var(--text-lo)',
                              }}>
                              {isOpen ? 'Fechar' : 'Ver'}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="md:hidden px-4 py-4" style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--bg-border)' }}>
                            {detailPanel}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel (desktop only) */}
        <div className="hidden md:flex flex-1 flex-col overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
          {selectedClient ? (
            <div className="px-6 py-4 pb-24">{detailPanel}</div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-sm t-text-lo">Selecione um cliente para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal criar cliente */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-lg rounded-t-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <h2 className="font-bold text-base t-text-hi">Novo Cliente</h2>
              <button onClick={() => setShowCreate(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-page)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Nome completo *', key: 'name', type: 'text', placeholder: 'João Silva' },
                { label: 'E-mail *', key: 'email', type: 'email', placeholder: 'joao@email.com' },
                { label: 'Senha *', key: 'password', type: 'password', placeholder: 'Mínimo 6 caracteres' },
                { label: 'Telefone', key: 'phone', type: 'tel', placeholder: '(11) 99999-9999' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium t-text-lo mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={newClient[f.key as keyof typeof newClient]}
                    onChange={e => setNewClient(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                  />
                </div>
              ))}
              <button
                onClick={createClient}
                disabled={creating || !newClient.name || !newClient.email || !newClient.password}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl mt-2 disabled:opacity-60"
              >
                {creating ? 'Criando...' : 'Criar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contratoUser && (
        <ContratoModal
          user={contratoUser as { id: number; name: string; email: string }}
          onClose={() => setContratoUser(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
