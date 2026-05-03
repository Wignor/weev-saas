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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Pin head — white circle with blue dot */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#007AFF' }} />
          </div>
          {/* Pin tail — rotated white square overlapping circle */}
          <div style={{
            width: 38,
            height: 38,
            background: 'white',
            transform: 'rotate(45deg)',
            marginTop: -22,
          }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
