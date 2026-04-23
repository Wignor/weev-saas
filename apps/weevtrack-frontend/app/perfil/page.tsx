'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

function getUserFromCookie() {
  if (typeof document === 'undefined') return { name: '', email: '', administrator: false };
  try {
    const raw = document.cookie.split('; ').find((r) => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
    if (!raw) return { name: '', email: '', administrator: false };
    return JSON.parse(decodeURIComponent(raw));
  } catch { return { name: '', email: '', administrator: false }; }
}

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState({ name: '', email: '', administrator: false });
  const [notifStatus, setNotifStatus] = useState<'idle' | 'active' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    setUser(getUserFromCookie());
    if (!('Notification' in window)) { setNotifStatus('unsupported'); return; }
    if (Notification.permission === 'granted') setNotifStatus('active');
    else if (Notification.permission === 'denied') setNotifStatus('denied');
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const notifLabel: Record<string, string> = {
    active: '✅ Ativadas',
    denied: '❌ Bloqueadas',
    idle: '⚪ Não ativadas',
    unsupported: '⚠️ Não suportado',
  };

  const menuItems = [
    {
      section: 'Conta',
      items: [
        { icon: '👤', label: 'Nome', value: user.name },
        { icon: '📧', label: 'E-mail', value: user.email },
        { icon: '🔑', label: 'Perfil', value: user.administrator ? 'Administrador' : 'Usuário' },
      ],
    },
    {
      section: 'Notificações',
      items: [
        { icon: '🔔', label: 'Push notifications', value: notifLabel[notifStatus] },
        { icon: '🔑', label: 'Ignição liga/desliga', value: 'Ativo' },
        { icon: '🚦', label: 'Excesso de velocidade', value: 'Via Traccar' },
        { icon: '🔋', label: 'Bateria fraca', value: 'Via Traccar' },
      ],
    },
    {
      section: 'Sobre',
      items: [
        { icon: '📱', label: 'Versão do app', value: '1.0.0' },
        { icon: '🌐', label: 'Servidor', value: 'app.weevtrack.com' },
        { icon: '⚙️', label: 'Protocolo', value: 'GT06 / Traccar' },
      ],
    },
  ];

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#12131A' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: '#1E2030', borderBottom: '1px solid #2A2D3E' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <h1 className="font-bold text-app-text">Perfil</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Avatar */}
        <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3">
            <span className="text-3xl font-bold text-white">
              {user.name ? user.name.charAt(0).toUpperCase() : '?'}
            </span>
          </div>
          <h2 className="font-bold text-app-text text-lg">{user.name || 'Usuário'}</h2>
          <p className="text-app-muted text-sm">{user.email}</p>
        </div>

        {/* Seções */}
        {menuItems.map((section) => (
          <div key={section.section} className="mb-4">
            <p className="text-xs font-semibold text-app-muted uppercase tracking-wider px-4 mb-2">
              {section.section}
            </p>
            <div style={{ background: '#1E2030', borderTop: '1px solid #2A2D3E', borderBottom: '1px solid #2A2D3E' }}>
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: i < section.items.length - 1 ? '1px solid #2A2D3E' : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="text-sm text-app-text">{item.label}</span>
                  </div>
                  <span className="text-sm text-app-muted truncate max-w-[160px] text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="px-4 mt-4 mb-8">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }}
          >
            Sair da conta
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
