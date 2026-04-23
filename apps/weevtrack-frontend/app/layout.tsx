import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeevTrack — Rastreamento Veicular',
  description: 'Plataforma de rastreamento veicular WeevTrack',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
