import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeevTrack — Rastreamento Veicular',
    short_name: 'WeevTrack',
    description: 'Plataforma de rastreamento veicular WeevTrack',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F5F5F5',
    theme_color: '#007AFF',
    orientation: 'portrait',
    categories: ['navigation', 'utilities'],
    icons: [
      {
        src: '/api/icons/192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icons/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icons/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
