import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeevZap',
  description: 'Atendimento inteligente no WhatsApp com IA',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
      </head>
      <body className="bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
