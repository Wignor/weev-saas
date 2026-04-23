'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavbarProps {
  userName: string;
  currentPath: string;
}

export default function Navbar({ userName, currentPath }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const links = [
    { href: '/dashboard', label: 'Mapa ao Vivo' },
    { href: '/historico', label: 'Histórico' },
  ];

  return (
    <nav className="h-14 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 flex-shrink-0" style={{ zIndex: 500, position: 'relative' }}>
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 no-underline">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" fill="white"/>
            <path d="M7 1 L7 3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M7 10.5 L7 13" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M1 7 L3.5 7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M10.5 7 L13 7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-bold text-dark text-base">WeevTrack</span>
      </Link>

      {/* Menu central */}
      <div className="hidden md:flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all no-underline ${
              currentPath === link.href
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-dark hover:bg-surface'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Usuário + logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-dark max-w-[120px] truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-danger transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </nav>
  );
}
