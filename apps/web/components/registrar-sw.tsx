'use client';

import { useEffect } from 'react';

/** Registra o service worker (cache de leitura + PWA instalável — Fase 10). */
export function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // sem service worker, o app continua funcionando normal — só sem cache offline
      });
    }
  }, []);
  return null;
}
