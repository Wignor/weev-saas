'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Invoice {
  id: string;
  value: number;
  dueDate: string;
  status: string;
  billingType: string;
  invoiceUrl: string | null;
  description: string;
}

interface ContratoInfo {
  token: string;
  signedAt: string;
  templateName: string;
  url: string;
}

function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', email: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find((r) => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', email: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', email: '', administrator: false }; }
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('wt_theme', next); } catch { /**/ }
}

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Pago', CONFIRMED: 'Pago', RECEIVED_IN_CASH: 'Pago',
  PENDING: 'Pendente', OVERDUE: 'Vencido', REFUNDED: 'Estornado',
};
const STATUS_COLOR: Record<string, string> = {
  RECEIVED: '#34C759', CONFIRMED: '#34C759', RECEIVED_IN_CASH: '#34C759',
  PENDING: '#FF9500', OVERDUE: '#FF3B30', REFUNDED: '#6B7280',
};
const STATUS_BG: Record<string, string> = {
  RECEIVED: 'rgba(52,199,89,0.12)', CONFIRMED: 'rgba(52,199,89,0.12)', RECEIVED_IN_CASH: 'rgba(52,199,89,0.12)',
  PENDING: 'rgba(255,149,0,0.12)', OVERDUE: 'rgba(255,59,48,0.1)', REFUNDED: 'rgba(107,114,128,0.12)',
};

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, unknown>>({ name: '', email: '', administrator: false });
  const [fullUser, setFullUser] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [contrato, setContrato] = useState<ContratoInfo | null>(null);
  const [contratoLoading, setContratoLoading] = useState(true);

  const [showPwModal, setShowPwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    setUser(getUserFromCookie());

    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setFullUser(d); }).catch(() => {});

    fetch('/api/me/invoices').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setInvoices(d);
    }).catch(() => {}).finally(() => setInvoicesLoading(false));

    fetch('/api/me/contrato').then(r => r.json()).then(d => {
      if (d && d.token) setContrato(d);
    }).catch(() => {}).finally(() => setContratoLoading(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function openPwModal() {
    setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwMsg('');
    setShowPwModal(true);
  }

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) { setPwMsg('❌ Preencha todos os campos'); return; }
    if (pwNew !== pwConfirm) { setPwMsg('❌ As senhas não conferem'); return; }
    if (pwNew.length < 6) { setPwMsg('❌ A nova senha deve ter pelo menos 6 caracteres'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (res.ok) { setPwMsg('✅ Senha alterada com sucesso!'); setTimeout(() => setShowPwModal(false), 1500); }
      else setPwMsg(`❌ ${data.error || 'Erro ao alterar senha'}`);
    } catch { setPwMsg('❌ Erro de conexão'); }
    setPwLoading(false);
  }

  async function requestAssistance() {
    const phone = '5519999780601';
    const baseText = 'Olá! Preciso de assistência técnica com o WeevTrack.';
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const text = `${baseText}\n📍 Minha localização: https://maps.google.com/?q=${latitude},${longitude}`;
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
        },
        () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(baseText)}`, '_blank')
      );
    } else {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(baseText)}`, '_blank');
    }
  }

  const attrs = (fullUser?.attributes || user.attributes || {}) as Record<string, string>;
  const clientSince = attrs.clientSince;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtCurrency(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="flex flex-col sidebar-offset" style={{ height: '100dvh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <h1 className="font-bold t-text-hi">Perfil</h1>
        <button onClick={toggleTheme} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-border)' }} title="Alternar tema">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Avatar */}
        <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3">
            <span className="text-3xl font-bold text-white">
              {user.name ? String(user.name).charAt(0).toUpperCase() : '?'}
            </span>
          </div>
          <h2 className="font-bold t-text-hi text-lg">{String(user.name || 'Usuário')}</h2>
          <p className="t-text-lo text-sm">{String(user.email || '')}</p>
        </div>

        {/* Conta */}
        <div className="mb-4">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider px-4 mb-2">Conta</p>
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
            {[
              { icon: '👤', label: 'Nome', value: String(user.name || '') },
              { icon: '📧', label: 'E-mail', value: String(user.email || '') },
              { icon: '🔑', label: 'Perfil', value: user.administrator ? 'Administrador' : 'Usuário' },
              ...(clientSince ? [{ icon: '📅', label: 'Cliente desde', value: clientSince }] : []),
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span className="text-sm t-text-hi">{item.label}</span>
                </div>
                <span className="text-sm t-text-lo truncate max-w-[160px] text-right">{item.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--bg-border)' }}>
              <button onClick={openPwModal} className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span>🔒</span>
                  <span className="text-sm t-text-hi">Alterar senha</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div className="mb-4">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider px-4 mb-2">Financeiro</p>
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
            {invoicesLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span>💰</span>
                  <span className="text-sm t-text-hi">Faturas</span>
                </div>
                <span className="text-xs t-text-lo">Nenhuma cobrança encontrada</span>
              </div>
            ) : invoices.map((inv, i) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t-text-hi">{fmtCurrency(inv.value)}</p>
                  <p className="text-xs t-text-lo">Venc. {fmtDate(inv.dueDate)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: STATUS_BG[inv.status] || 'rgba(107,114,128,0.12)', color: STATUS_COLOR[inv.status] || '#6B7280' }}>
                    {STATUS_LABEL[inv.status] || inv.status}
                  </span>
                  {inv.invoiceUrl && (inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                    <a href={inv.invoiceUrl} target="_blank" rel="noreferrer"
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold no-underline"
                      style={{ background: 'rgba(0,122,255,0.12)', color: '#007AFF' }}>
                      Pagar
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contrato */}
        <div className="mb-4">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider px-4 mb-2">Contrato</p>
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
            {contratoLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : contrato ? (
              <a href={contrato.url} target="_blank" rel="noreferrer"
                className="flex items-center justify-between px-4 py-3 no-underline"
                style={{ borderBottom: 'none' }}>
                <div className="flex items-center gap-3">
                  <span>📄</span>
                  <div>
                    <p className="text-sm t-text-hi font-medium">{contrato.templateName}</p>
                    <p className="text-xs t-text-lo">Assinado em {fmtDate(contrato.signedAt)}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                  style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759' }}>
                  Ver / Baixar
                </span>
              </a>
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span>📄</span>
                  <span className="text-sm t-text-hi">Contrato</span>
                </div>
                <span className="text-xs t-text-lo">Nenhum contrato assinado</span>
              </div>
            )}
          </div>
        </div>

        {/* Suporte */}
        <div className="mb-4">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider px-4 mb-2">Suporte</p>
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
            <button onClick={requestAssistance} className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span>🆘</span>
                <div className="text-left">
                  <p className="text-sm t-text-hi">Solicitar assistência</p>
                  <p className="text-xs t-text-lo">WhatsApp com sua localização</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Sobre */}
        <div className="mb-4">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider px-4 mb-2">Sobre</p>
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
            {[
              { icon: '📱', label: 'Versão do app', value: '1.0.0' },
              { icon: '🌐', label: 'Servidor', value: 'app.weevtrack.com' },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span className="text-sm t-text-hi">{item.label}</span>
                </div>
                <span className="text-sm t-text-lo">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 mt-4 mb-8">
          <button onClick={handleLogout}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }}>
            Sair da conta
          </button>
        </div>
      </div>

      <BottomNav />

      {/* Modal: Alterar senha */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowPwModal(false)}>
          <div className="w-full rounded-t-2xl p-5 pb-10 slide-up"
            style={{ background: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--bg-border)' }} />
            <h3 className="font-bold t-text-hi text-lg mb-1">Alterar senha</h3>
            <p className="text-xs t-text-lo mb-5">A nova senha deve ter pelo menos 6 caracteres</p>
            <div className="space-y-3">
              {[
                { label: 'Senha atual', value: pwCurrent, setter: setPwCurrent },
                { label: 'Nova senha', value: pwNew, setter: setPwNew },
                { label: 'Confirmar nova senha', value: pwConfirm, setter: setPwConfirm },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-xs font-medium t-text-lo mb-1.5">{field.label}</label>
                  <input type="password" placeholder="••••••••" value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ background: 'var(--bg-page)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)' }}
                  />
                </div>
              ))}
              {pwMsg && (
                <p className="text-sm text-center font-medium px-2 py-2 rounded-xl"
                  style={{
                    background: pwMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                    color: pwMsg.startsWith('✅') ? '#34C759' : '#FF3B30',
                  }}>
                  {pwMsg}
                </p>
              )}
              <button onClick={handleChangePassword} disabled={pwLoading}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl mt-2 disabled:opacity-60 transition-all">
                {pwLoading ? 'Alterando...' : 'Salvar nova senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
