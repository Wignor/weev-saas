import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180,
        height: 180,
        background: '#007AFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Pin shape: circle head + rotated square tail */}
        <div style={{ position: 'relative', width: 80, height: 112, display: 'flex' }}>
          {/* Circle (pin head) */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: 80, height: 80,
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#007AFF' }} />
          </div>
          {/* Tail: rotated square creating diamond tip */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 20,
            width: 40,
            height: 40,
            background: 'white',
            transform: 'rotate(45deg)',
          }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
