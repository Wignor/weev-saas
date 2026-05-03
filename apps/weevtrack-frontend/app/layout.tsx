import type { Metadata } from 'next';
import './globals.css';
import DesktopNav from '@/components/DesktopNav';

export const metadata: Metadata = {
  title: 'WeevTrack — Rastreamento Veicular',
  description: 'Plataforma de rastreamento veicular WeevTrack',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WeevTrack',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#007AFF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WeevTrack" />
        {/* Runs synchronously before first paint — prevents theme and nav-collapsed flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wt_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}try{if(localStorage.getItem('nav_collapsed')==='1')document.body.classList.add('nav-collapsed');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <DesktopNav />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.warn('SW:',e);});});}`,
          }}
        />
      </body>
    </html>
  );
}
