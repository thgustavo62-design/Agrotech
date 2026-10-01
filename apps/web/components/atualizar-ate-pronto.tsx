'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Recarrega os dados da página a cada `segundos` enquanto algo roda em segundo plano (ex.: OCR). */
export function AtualizarAtePronto({ segundos = 4 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
