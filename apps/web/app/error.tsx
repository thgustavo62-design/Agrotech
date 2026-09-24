'use client';

import { ErroView } from '@/components/erro-view';

export default function ErroRaiz({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroView error={error} reset={reset} voltarHref="/login" />;
}
