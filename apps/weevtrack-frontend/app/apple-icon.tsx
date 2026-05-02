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
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 135,
            height: 135,
            borderRadius: '50%',
            border: '7px solid rgba(255,255,255,0.3)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,0.5)',
          }}
        />
        <div
          style={{
            width: 40,
            height: 40,
            background: 'white',
            borderRadius: '50%',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
