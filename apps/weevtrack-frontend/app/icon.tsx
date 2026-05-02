import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#007AFF',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.4)',
          }}
        />
        <div
          style={{
            width: 8,
            height: 8,
            background: 'white',
            borderRadius: '50%',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
