import { ImageResponse } from 'next/og';
import { LogoMarca } from '@/components/logo';

/** Ícone do manifest PWA, gerado sob demanda (sem binário no repo) — mesma marca de components/logo.tsx. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = size === '512' ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0f5c43',
        }}
      >
        <LogoMarca tamanho={n * 0.68} />
      </div>
    ),
    { width: n, height: n },
  );
}
