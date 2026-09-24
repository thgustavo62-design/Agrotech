import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f5c43' }}>
        <div style={{ width: 14, height: 14, background: '#eef1ec', borderRadius: 2, transform: 'rotate(45deg)' }} />
      </div>
    ),
    size,
  );
}
