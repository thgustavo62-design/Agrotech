'use client';

import { ErroView } from '@/components/erro-view';

export default function ErroConsultor({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroView error={error} reset={reset} voltarHref="/app" />;
}
