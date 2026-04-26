'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface TUser { id: number; name: string; email: string; administrator: boolean; }
interface TDevice { id: number; name: string; uniqueId: string; status: string; }

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /* */ }
}

export default function GestaoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clientes' | 'dispositivos'>('clientes');
  const [users, setUsers] = useState<TUser[]>([]);
  const [allDevices, setAllDevices] = useState<TDevice[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [selectedUser, setSelectedUser] = useState<TUser | null>(null);
  const [userDevices, setUserDevices] = useState<TDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateDevice, setShowCreateDevice] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', phone: '', cpfCnpj: '' });
  const [newDevice, setNewDevice] = useState({ name: '', uniqueId: '', modelo: '', iccid: '', chip: '' });
  const [creating, setCreating] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [renamingDeviceId, setRenamingDeviceId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [licenses, setLicenses] = useState<Record<string, { expiresAt: string; daysLeft: number; status: string }>>({});

  useEffect(() => {
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
      if (raw) {
        const u = JSON.parse(decodeURIComponent(raw));
        if (!u.administrator) router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    } catch { router.replace('/login'); }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, devicesRes, assignRes, licRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/devices'),
        fetch('/api/admin/assignments'),
        fetch('/api/licenses'),
      ]);
      const [usersData, devicesData, assignData, licData] = await Promise.all([
        usersRes.json(), devicesRes.json(), assignRes.json(), licRes.json(),
      ]);
      if (Array.isArray(usersData)) setUsers(usersData.filter(u => !u.administrator));
      if (Array.isArray(devicesData)) setAllDevices(devicesData);
      if (assignData && typeof assignData === 'object') setAssignments(assignData);
      if (licData && typeof licData === 'object') setLicenses(licData);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  async function selectUser(user: TUser) {
    if (selectedUser?.id === user.id) {
      setSelectedUser(null);
      setUserDevices([]);
      return;
    }
    setSelectedUser(user);
    setLoadingDevices(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/devices`);
      const data = await res.json();
      setUserDevices(Array.isArray(data) ? data : []);
    } catch { setUserDevices([]); }
    setLoadingDevices(false);
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  }

  async function createUser() {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        flash('✅ Cliente criado com sucesso');
        setNewUser({ name: '', email: '', password: '', phone: '', cpfCnpj: '' });
        setShowCreate(false);
        await loadData();
      } else {
        const err = await res.json();
        flash(`❌ ${err.error || 'Erro ao criar'}`);
      }
    } catch { flash('❌ Erro de conexão'); }
    setCreating(false);
  }

  async function renewLicense(deviceId: number, userId: number) {
    const res = await fetch('/api/admin/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, userId }),
    });
    if (res.ok) {
      const data = await res.json();
      setLicenses(prev => ({ ...prev, [String(deviceId)]: { expiresAt: data.expiresAt, daysLeft: data.daysLeft, status: data.status } }));
      flash(`✅ Licença renovada — expira em ${data.daysLeft} dias`);
    } else {
      flash('❌ Erro ao renovar licença');
    }
  }

  async function resetPassword(userId: number, userName: string) {
    if (!confirm(`Resetar a senha de "${userName}" para a senha padrão (as123456)?`)) return;
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
    if (res.ok) flash('✅ Senha resetada para: as123456');
    else flash('❌ Erro ao resetar senha');
  }

  async function deleteUser(userId: number) {
    if (!confirm('Excluir este cliente?')) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUser?.id === userId) { setSelectedUser(null); setUserDevices([]); }
      flash('✅ Cliente excluído');
    } else {
      flash('❌ Erro ao excluir');
    }
  }

  async function assignDevice(deviceId: number) {
    if (!selectedUser) return;
    const res = await fetch(`/api/admin/users/${selectedUser.id}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      const device = allDevices.find(d => d.id === deviceId);
      if (device) setUserDevices(prev => [...prev, device]);
      setAssignments(prev => ({ ...prev, [deviceId]: selectedUser.name }));
      flash('✅ Dispositivo atribuído');
    } else {
      flash('❌ Erro ao atribuir dispositivo');
    }
  }

  async function removeDevice(deviceId: number) {
    if (!selectedUser) return;
    const res = await fetch(`/api/admin/users/${selectedUser.id}/devices`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      setUserDevices(prev => prev.filter(d => d.id !== deviceId));
      setAssignments(prev => { const next = { ...prev }; delete next[deviceId]; return next; });
      flash('✅ Dispositivo removido');
    } else {
      flash('❌ Erro ao remover');
    }
  }

  async function sendCmd(deviceId: number, type: string) {
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, type }),
      });
      flash(res.ok ? '✅ Comando enviado' : '❌ Falha ao enviar comando');
    } catch { flash('❌ Erro de conexão'); }
  }

  async function createDevice() {
    if (!newDevice.name || !newDevice.uniqueId) return;
    setCreatingDevice(true);
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice),
      });
      if (res.ok) {
        flash('✅ Dispositivo cadastrado com sucesso');
        setNewDevice({ name: '', uniqueId: '', modelo: '', iccid: '', chip: '' });
        setShowCreateDevice(false);
        await loadData();
      } else {
        const err = await res.json();
        flash(`❌ ${err.error || 'Erro ao cadastrar'}`);
      }
    } catch { flash('❌ Erro de conexão'); }
    setCreatingDevice(false);
  }

  async function deleteDevice(deviceId: number) {
    if (!confirm('Excluir este dispositivo da plataforma? O rastreador precisará ser recadastrado para voltar.')) return;
    const res = await fetch('/api/admin/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      setAllDevices(prev => prev.filter(d => d.id !== deviceId));
      flash('✅ Dispositivo excluído');
    } else {
      flash('❌ Erro ao excluir dispositivo');
    }
  }

  async function renameDevice(deviceId: number) {
    if (!renameValue.trim()) return;
    const res = await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, name: renameValue.trim() }),
    });
    if (res.ok) {
      setAllDevices(prev => prev.map(d => d.id === deviceId ? { ...d, name: renameValue.trim() } : d));
      setRenamingDeviceId(null);
      flash('✅ Dispositivo renomeado');
    } else {
      flash('❌ Erro ao renomear');
    }
  }

  function statusColor(status: string) {
    return status === 'online' ? '#34C759' : 'var(--text-lo)';
  }

  const unassigned = allDevices.filter(d => !userDevices.find(ud => ud.id === d.id));

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h1 className="font-bold t-text-hi">Gestão</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-border)' }} title="Alternar tema">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
          <button
            onClick={() => activeTab === 'clientes' ? setShowCreate(true) : setShowCreateDevice(true)}
            className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            {activeTab === 'clientes' ? '+ Novo cliente' : '+ Novo dispositivo'}
          </button>
        </div>
      </header>

      {/* Desktop nav tabs */}
      <div className="hidden md:flex flex-shrink-0 px-4 gap-1"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', paddingTop: '6px', paddingBottom: '6px' }}>
        {[
          { href: '/dashboard', label: 'Monitor' },
          { href: '/historico', label: 'Trajetos' },
          { href: '/alertas', label: 'Alertas' },
          { href: '/gestao', label: 'Gestão' },
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
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex px-4 py-2 gap-2"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        {(['clientes', 'dispositivos'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === tab ? '#007AFF' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--text-lo)',
            }}
          >
            {tab === 'clientes' ? `Clientes (${users.length})` : `Dispositivos (${allDevices.length})`}
          </button>
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

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'clientes' ? (

          /* ─── CLIENTES TAB ─── */
          <>
            {users.length === 0 ? (
              <div className="text-center py-12 px-8">
                <div className="text-5xl mb-4">👥</div>
                <p className="t-text-lo text-sm">Nenhum cliente cadastrado</p>
                <p className="t-text-lo text-xs mt-1">Toque em "+ Novo cliente" para adicionar</p>
              </div>
            ) : (
              <div className="mt-2" style={{ borderTop: '1px solid var(--bg-border)' }}>
                {users.map(user => (
                  <div key={user.id}>
                    <div className="flex items-center gap-3 px-4 py-3"
                      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,122,255,0.15)' }}>
                        <span className="font-bold text-sm" style={{ color: '#007AFF' }}>
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <button className="flex-1 text-left" onClick={() => selectUser(user)}>
                        <p className="text-sm font-semibold t-text-hi">{user.name}</p>
                        <p className="text-xs t-text-lo">{user.email}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/dashboard?asUser=${user.id}&asUserName=${encodeURIComponent(user.name)}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 no-underline"
                          style={{ background: 'rgba(88,86,214,0.12)', border: '1px solid rgba(88,86,214,0.2)' }}
                          title="Ver monitor do cliente"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </a>
                        <button
                          onClick={() => selectUser(user)}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                          style={{
                            background: selectedUser?.id === user.id ? '#007AFF' : 'var(--bg-border)',
                            color: selectedUser?.id === user.id ? 'white' : 'var(--text-lo)',
                          }}
                        >
                          {selectedUser?.id === user.id ? 'Fechar' : 'Dispositivos'}
                        </button>
                        <button
                          onClick={() => resetPassword(user.id, user.name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(255,149,0,0.12)' }}
                          title="Resetar senha para padrão"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(255,59,48,0.1)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {selectedUser?.id === user.id && (
                      <div className="px-4 py-4" style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--bg-border)' }}>
                        {loadingDevices ? (
                          <div className="flex justify-center py-4">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-semibold t-text-lo uppercase tracking-wider mb-3">
                              Atribuídos a {user.name} ({userDevices.length})
                            </p>
                            {userDevices.length === 0 ? (
                              <p className="text-xs t-text-lo mb-4 text-center py-2">Nenhum dispositivo atribuído ainda</p>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {userDevices.map(device => (
                                  <div key={device.id} className="rounded-xl px-3 py-2.5"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(device.status) }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium t-text-hi truncate">{device.name}</p>
                                          <p className="text-xs t-text-lo">{device.uniqueId}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {(() => {
                                          const lic = licenses[String(device.id)];
                                          const licColor = !lic ? '#6B7280' : lic.status === 'expired' ? '#FF3B30' : lic.status === 'expiring' ? '#FF9500' : '#34C759';
                                          const licLabel = !lic ? 'Sem licença' : lic.status === 'expired' ? 'Expirado' : `${lic.daysLeft}d`;
                                          return (
                                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                              style={{ background: `${licColor}18`, color: licColor }}>
                                              {licLabel}
                                            </span>
                                          );
                                        })()}
                                        <button
                                          onClick={() => renewLicense(device.id, selectedUser!.id)}
                                          className="text-xs px-2 py-1 rounded-lg font-medium"
                                          style={{ background: 'rgba(0,122,255,0.12)', color: '#007AFF' }}
                                          title="Renovar licença +31 dias"
                                        >
                                          Renovar
                                        </button>
                                        <button
                                          onClick={() => removeDevice(device.id)}
                                          className="text-xs px-2 py-1 rounded-lg font-medium"
                                          style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                                        >
                                          Remover
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => sendCmd(device.id, 'engineStop')}
                                        className="text-xs py-1.5 rounded-lg font-medium"
                                        style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                                      >
                                        🔒 Bloquear
                                      </button>
                                      <button
                                        onClick={() => sendCmd(device.id, 'engineResume')}
                                        className="text-xs py-1.5 rounded-lg font-medium"
                                        style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759' }}
                                      >
                                        🔓 Desbloquear
                                      </button>
                                    </div>
                                  </div>
                                ))}
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
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(device.status) }} />
                                        <div>
                                          <p className="text-sm font-medium t-text-hi">{device.name}</p>
                                          <p className="text-xs t-text-lo">{device.uniqueId}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => assignDevice(device.id)}
                                        className="text-xs px-2.5 py-1 rounded-lg font-medium"
                                        style={{ background: 'rgba(0,122,255,0.15)', color: '#007AFF' }}
                                      >
                                        Atribuir
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>

        ) : (

          /* ─── DISPOSITIVOS TAB ─── */
          <>
            {allDevices.length === 0 ? (
              <div className="text-center py-12 px-8">
                <div className="text-5xl mb-4">📡</div>
                <p className="t-text-lo text-sm">Nenhum dispositivo cadastrado</p>
                <p className="t-text-lo text-xs mt-1">Toque em "+ Novo dispositivo" para adicionar</p>
              </div>
            ) : (
              <div className="mt-2" style={{ borderTop: '1px solid var(--bg-border)' }}>
                {allDevices.map(device => {
                  const isRenaming = renamingDeviceId === device.id;
                  const clientName = assignments[device.id];
                  return (
                    <div key={device.id} className="px-4 py-3"
                      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--bg-page)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={statusColor(device.status)} strokeWidth="1.8" strokeLinecap="round">
                            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                            <circle cx="7.5" cy="17.5" r="2.5"/>
                            <circle cx="17.5" cy="17.5" r="2.5"/>
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renameDevice(device.id);
                                  if (e.key === 'Escape') setRenamingDeviceId(null);
                                }}
                                className="flex-1 rounded-lg px-2 py-1 text-sm focus:outline-none"
                                style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid #007AFF' }}
                              />
                              <button onClick={() => renameDevice(device.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(52,199,89,0.15)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </button>
                              <button onClick={() => setRenamingDeviceId(null)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(255,59,48,0.1)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold t-text-hi truncate">{device.name}</p>
                          )}
                          <p className="text-xs t-text-lo mt-0.5 font-mono">{device.uniqueId}</p>
                          {clientName && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full mt-1"
                              style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                              👤 {clientName}
                            </span>
                          )}
                          {!clientName && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full mt-1"
                              style={{ background: 'rgba(107,114,128,0.1)', color: 'var(--text-lo)' }}>
                              Sem cliente
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!isRenaming && (
                            <button
                              onClick={() => { setRenamingDeviceId(device.id); setRenameValue(device.name); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(0,122,255,0.1)' }}
                              title="Renomear"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => deleteDevice(device.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(255,59,48,0.1)' }}
                            title="Excluir"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Novo cliente */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowCreate(false)}>
          <div className="w-full rounded-t-2xl p-5 pb-10 slide-up"
            style={{ background: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--bg-border)' }} />
            <h3 className="font-bold t-text-hi text-lg mb-5">Novo cliente</h3>
            <div className="space-y-3">
              {([
                { label: 'Nome completo', key: 'name', type: 'text', placeholder: 'Ex: João Silva' },
                { label: 'E-mail de acesso', key: 'email', type: 'email', placeholder: 'joao@email.com' },
                { label: 'Senha inicial', key: 'password', type: 'password', placeholder: '••••••••' },
                { label: 'Telefone', key: 'phone', type: 'tel', placeholder: 'Ex: (11) 99999-9999' },
                { label: 'CPF ou CNPJ', key: 'cpfCnpj', type: 'text', placeholder: 'Ex: 123.456.789-00' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium t-text-lo mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={newUser[field.key]}
                    onChange={e => setNewUser(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                  />
                </div>
              ))}
              <button
                onClick={createUser}
                disabled={creating || !newUser.name || !newUser.email || !newUser.password}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl mt-2 disabled:opacity-60 transition-all"
              >
                {creating ? 'Criando...' : 'Criar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo dispositivo */}
      {showCreateDevice && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowCreateDevice(false)}>
          <div className="w-full rounded-t-2xl p-5 pb-10 slide-up"
            style={{ background: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--bg-border)' }} />
            <h3 className="font-bold t-text-hi text-lg mb-1">Novo dispositivo</h3>
            <p className="text-xs t-text-lo mb-5">Cadastre um novo rastreador GPS na plataforma</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium t-text-lo mb-1.5">Nome do veículo</label>
                <input
                  type="text"
                  placeholder="Ex: VW Gol - ABC-1234"
                  value={newDevice.name}
                  onChange={e => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium t-text-lo mb-1.5">IMEI / ID único do aparelho</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 355488062098989"
                  value={newDevice.uniqueId}
                  onChange={e => setNewDevice(prev => ({ ...prev, uniqueId: e.target.value.replace(/\s/g, '') }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none font-mono tracking-wide"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
                <p className="text-xs t-text-lo mt-1.5">📦 Consulte a etiqueta ou embalagem do aparelho</p>
              </div>
              <div>
                <label className="block text-xs font-medium t-text-lo mb-1.5">Modelo do aparelho</label>
                <input
                  type="text"
                  placeholder="Ex: ST-340, TK303G"
                  value={newDevice.modelo}
                  onChange={e => setNewDevice(prev => ({ ...prev, modelo: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium t-text-lo mb-1.5">ICCID do chip</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 89550177..."
                  value={newDevice.iccid}
                  onChange={e => setNewDevice(prev => ({ ...prev, iccid: e.target.value.replace(/\s/g, '') }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none font-mono tracking-wide"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium t-text-lo mb-1.5">Número do chip</label>
                <input
                  type="tel"
                  placeholder="Ex: (11) 98765-4321"
                  value={newDevice.chip}
                  onChange={e => setNewDevice(prev => ({ ...prev, chip: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                />
              </div>
              <button
                onClick={createDevice}
                disabled={creatingDevice || !newDevice.name || !newDevice.uniqueId}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl mt-2 disabled:opacity-60 transition-all"
              >
                {creatingDevice ? 'Cadastrando...' : 'Cadastrar dispositivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
