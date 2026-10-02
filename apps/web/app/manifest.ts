import type { MetadataRoute } from 'next';

/**
 * PWA instalável — Fase 10 do pedido. Escopo deliberado (UX_ARCHITECTURE.md
 * §8.4): instalável + cache de leitura de páginas já visitadas. A fila de
 * escrita offline (registrar visita sem sinal) veio depois: lib/fila-offline.ts.
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
    id: '/',
    scope: '/',
    categories: ['business', 'productivity'],
    // atalhos ao segurar o ícone do app no celular
    shortcuts: [
      { name: 'Lançar análise', short_name: 'Análise', url: '/app/analises/nova' },
      { name: 'Enviar laudo (PDF)', short_name: 'Laudo', url: '/app/laudos/novo' },
      { name: 'Agenda de campo', short_name: 'Agenda', url: '/app/agenda' },
    ],
    icons: [
      { src: '/icones-pwa/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones-pwa/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones-pwa/192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icones-pwa/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
