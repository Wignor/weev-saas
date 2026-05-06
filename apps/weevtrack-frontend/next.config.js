/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/icons/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=86400, immutable' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/icons/192.png', destination: '/api/icons/192' },
      { source: '/api/icons/512.png', destination: '/api/icons/512' },
    ];
  },
};

module.exports = nextConfig;
