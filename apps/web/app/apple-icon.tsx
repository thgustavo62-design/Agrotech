import { ImageResponse } from 'next/og';
import { logoIconeDataUri } from '@/lib/logo-buffer';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const logo = await logoIconeDataUri();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f5c43' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={132} height={117} alt="" />
      </div>
    ),
    size,
  );
}
