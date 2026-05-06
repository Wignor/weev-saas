import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1024,
          height: 500,
          background: 'linear-gradient(135deg, #005BBB 0%, #007AFF 50%, #0096FF 100%)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 60,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {/* Pin icon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="160" height="200" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M50 4C29.5 4 13 20.5 13 41C13 66 50 116 50 116C50 116 87 66 87 41C87 20.5 70.5 4 50 4Z"
              fill="white"
            />
            <circle cx="50" cy="41" r="18" fill="#007AFF" />
            <circle cx="50" cy="41" r="9" fill="white" opacity="0.6" />
          </svg>
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              color: 'white',
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            WeevTrack
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 32,
              fontWeight: 400,
              letterSpacing: 0.5,
            }}
          >
            Rastreamento veicular em tempo real
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            {['GPS ao vivo', 'Histórico de trajetos', 'Alertas inteligentes'].map((tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 20,
                  padding: '8px 18px',
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1024, height: 500 }
  );
}
