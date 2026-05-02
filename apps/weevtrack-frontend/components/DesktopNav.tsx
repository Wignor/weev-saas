'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

function NavIcon({ path, active }: { path: string; active: boolean }) {
  const c = active ? '#007AFF' : '#6B7280';
  const icons: Record<string, JSX.Element> = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" fill={active ? '#007AFF' : 'none'}/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
    historico: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    alertas: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    relatorios: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    distribuidor: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    gestao: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    perfil: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  };
  return icons[path] || null;
}

export default function DesktopNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDistribuidor, setIsDistribuidor] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!pathname || pathname === '/login') return;
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
      if (raw) {
        const u = JSON.parse(decodeURIComponent(raw));
        setIsAdmin(!!u.administrator);
        setIsDistribuidor(u.role === 'distribuidor' || u.role === 'distribuidor_geral');
      }
    } catch { /**/ }
    const saved = localStorage.getItem('nav_collapsed');
    const isCollapsed = saved === '1';
    setCollapsed(isCollapsed);
    if (isCollapsed) document.body.classList.add('nav-collapsed');
    else document.body.classList.remove('nav-collapsed');
  }, [pathname]);

  if (!pathname || pathname === '/login') return null;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) { document.body.classList.add('nav-collapsed'); localStorage.setItem('nav_collapsed', '1'); }
    else { document.body.classList.remove('nav-collapsed'); localStorage.removeItem('nav_collapsed'); }
  }

  const tabs = isDistribuidor
    ? [
        { key: 'distribuidor', href: '/distribuidor', label: 'Meu Painel' },
        { key: 'perfil',       href: '/perfil',       label: 'Perfil' },
      ]
    : [
        { key: 'dashboard',  href: '/dashboard',  label: 'Veículos' },
        { key: 'historico',  href: '/historico',  label: 'Trajetos' },
        { key: 'alertas',    href: '/alertas',    label: 'Alertas' },
        { key: 'relatorios', href: '/relatorios', label: 'Relatórios' },
        ...(isAdmin ? [{ key: 'gestao', href: '/gestao', label: 'Gestão' }] : []),
        { key: 'perfil',     href: '/perfil',     label: 'Perfil' },
      ];

  const W = collapsed ? 64 : 220;

  return (
    <div
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: W,
        background: 'var(--bg-card)', borderRight: '1px solid var(--bg-border)',
        zIndex: 200, transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '0 20px' : '0 16px',
        borderBottom: '1px solid var(--bg-border)', flexShrink: 0,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#007AFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
            <path d="M7 1C4.24 1 2 3.24 2 6C2 9.75 7 17.5 7 17.5C7 17.5 12 9.75 12 6C12 3.24 9.76 1 7 1Z" fill="white"/>
            <circle cx="7" cy="6" r="2" fill="#007AFF"/>
          </svg>
        </div>
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-hi)', whiteSpace: 'nowrap' }}>
            WeevTrack
          </span>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '8px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {tabs.map(tab => {
          const active = !!pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={collapsed ? tab.label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10, marginBottom: 2, textDecoration: 'none',
                background: active ? 'rgba(0,122,255,0.12)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <NavIcon path={tab.key} active={active} />
              {!collapsed && (
                <span style={{
                  fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
                  color: active ? '#007AFF' : 'var(--text-lo)',
                }}>
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Toggle collapse button */}
      <button
        onClick={toggle}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        style={{
          height: 44, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          padding: collapsed ? 0 : '0 16px',
          borderTop: '1px solid var(--bg-border)',
          background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
          {collapsed
            ? <polyline points="9 18 15 12 9 6"/>
            : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>
    </div>
  );
}
