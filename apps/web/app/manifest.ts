import type { MetadataRoute } from 'next';

/**
 * PWA instalável — Fase 10 do pedido. Escopo deliberado (UX_ARCHITECTURE.md
 * §8.4): instalável + cache de leitura de páginas já visitadas. Fila de
 * escrita offline (registrar visita sem sinal) fica pra depois — é maior
 * que cabe numa fase de polimento.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgroTech — Assistência técnica agronômica',
    short_name: 'AgroTech',
    description: 'Interpretação de solo, calagem, adubação e acompanhamento de safra — Campo Forte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef1ec',
    theme_color: '#0f5c43',
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    icons: [
      { src: '/icones-pwa/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones-pwa/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones-pwa/192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icones-pwa/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
