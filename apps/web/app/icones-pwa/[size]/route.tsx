import { ImageResponse } from 'next/og';
import { logoIconeDataUri } from '@/lib/logo-buffer';

/** Ícone do manifest PWA, gerado sob demanda (sem binário duplicado no repo) — mesma marca de lib/logo-buffer.ts. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = size === '512' ? 512 : 192;
  const logo = await logoIconeDataUri();
  const w = Math.round(n * 0.68);
  const h = Math.round(w * (283 / 320));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0f5c43',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={w} height={h} alt="" />
      </div>
    ),
    { width: n, height: n },
  );
}
