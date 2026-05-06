/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/icons/192.png', destination: '/api/icons/192' },
      { source: '/api/icons/512.png', destination: '/api/icons/512' },
    ];
  },
};

module.exports = nextConfig;
