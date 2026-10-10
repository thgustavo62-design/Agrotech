'use client';

import dynamic from 'next/dynamic';

/** O Leaflet precisa do navegador (window): este envoltório carrega o mapa só no cliente, sem quebrar a renderização do servidor. */
export const MapaPropriedadesLazy = dynamic(() => import('./mapa-propriedades').then((m) => m.MapaPropriedades), {
  ssr: false,
  loading: () => <div className="panorama-vazio" style={{ height: 320, display: 'grid', placeItems: 'center' }}>Carregando o mapa…</div>,
});
