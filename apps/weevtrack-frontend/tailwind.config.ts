import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        'primary-dark': '#0056b3',
        dark: '#1A1A1A',
        surface: '#F5F5F5',
        border: '#E0E0E0',
        success: '#34C759',
        danger: '#FF3B30',
        warning: '#FF9500',
        muted: '#808080',
        app: {
          bg: '#12131A',
          card: '#1E2030',
          hover: '#252840',
          border: '#2A2D3E',
          text: '#F0F0F5',
          muted: '#6B7280',
        },
      },
    },
  },
  plugins: [],
};

export default config;
