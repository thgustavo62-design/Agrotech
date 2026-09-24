import { ImageResponse } from 'next/og';

/** Ícone do manifest PWA, gerado sob demanda (sem binário no repo) — mesma marca de app/globals.css .marca::before. */
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
        <div
          style={{
            width: n * 0.42, height: n * 0.42, background: '#eef1ec',
            borderRadius: n * 0.07, transform: 'rotate(45deg)',
          }}
        />
      </div>
    ),
    { width: n, height: n },
  );
}
