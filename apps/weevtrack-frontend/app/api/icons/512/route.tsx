import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#007AFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}
      >
        {/* Location pin */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="200" height="240" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M50 4C29.5 4 13 20.5 13 41C13 66 50 116 50 116C50 116 87 66 87 41C87 20.5 70.5 4 50 4Z"
              fill="white"
            />
            <circle cx="50" cy="41" r="16" fill="#007AFF" />
            <circle cx="50" cy="41" r="8" fill="white" opacity="0.5" />
          </svg>
        </div>
        {/* WeevTrack text */}
        <div
          style={{
            color: 'white',
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: -1,
            marginTop: -8,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          WeevTrack
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
