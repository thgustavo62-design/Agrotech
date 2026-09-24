import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f5c43' }}>
        <div style={{ width: 76, height: 76, background: '#eef1ec', borderRadius: 12, transform: 'rotate(45deg)' }} />
      </div>
    ),
    size,
  );
}
