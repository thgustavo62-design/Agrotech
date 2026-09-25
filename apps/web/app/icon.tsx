import { ImageResponse } from 'next/og';
import { LogoMarca } from '@/components/logo';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f5c43' }}>
        <LogoMarca tamanho={24} />
      </div>
    ),
    size,
  );
}
