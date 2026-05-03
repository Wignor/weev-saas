import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36"><path d="M14 1C7.37 1 2 6.37 2 13C2 21.75 14 35 14 35C14 35 26 21.75 26 13C26 6.37 20.63 1 14 1Z" fill="white"/><circle cx="14" cy="13" r="5" fill="%23007AFF"/></svg>';

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#007AFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={`data:image/svg+xml,${svg}`}
          width={90}
          height={116}
          alt=""
        />
      </div>
    ),
    { ...size }
  );
}
