'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DesktopNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('wt_user='))?.split('=').slice(1).join('=');
      if (raw) { const u = JSON.parse(decodeURIComponent(raw)); setIsAdmin(!!u.administrator); }
    } catch { /**/ }
  }, []);

  const tabs = [
    { href: '/dashboard', label: 'Monitor' },
    { href: '/historico', label: 'Trajetos' },
    { href: '/alertas', label: 'Alertas' },
    ...(isAdmin ? [{ href: '/gestao', label: 'Gestão' }] : []),
    { href: '/perfil', label: 'Perfil' },
  ];

  return (
    <div className="hidden md:flex flex-shrink-0 items-center px-4 gap-1"
      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)', paddingTop: '6px', paddingBottom: '6px' }}>
      {tabs.map(tab => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href}
            className="px-4 py-1.5 rounded-lg text-sm font-medium no-underline transition-all"
            style={{ background: active ? '#007AFF' : 'transparent', color: active ? 'white' : 'var(--text-lo)' }}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
