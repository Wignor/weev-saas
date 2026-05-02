import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#007AFF',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#007AFF',
              }}
            />
          </div>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '38px solid transparent',
              borderRight: '38px solid transparent',
              borderTop: '38px solid white',
              marginTop: -2,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
