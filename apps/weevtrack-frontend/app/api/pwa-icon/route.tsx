import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = parseInt(searchParams.get('size') || '192');

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: '#007AFF',
          borderRadius: Math.round(size * 0.18),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: Math.round(size * 0.75),
            height: Math.round(size * 0.75),
            borderRadius: '50%',
            border: `${Math.max(2, Math.round(size * 0.04))}px solid rgba(255,255,255,0.3)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
            borderRadius: '50%',
            border: `${Math.max(2, Math.round(size * 0.03))}px solid rgba(255,255,255,0.5)`,
          }}
        />
        <div
          style={{
            width: Math.round(size * 0.22),
            height: Math.round(size * 0.22),
            background: 'white',
            borderRadius: '50%',
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
