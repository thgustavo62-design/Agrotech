import type { SVGProps } from 'react';

/** Ícones de linha dos formatos de conteúdo da Academy (cartões da página inicial). 28×28, herdam a cor do texto. */
type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({ width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });

export const IconeCursos = (p: P) => (
  <svg {...base(p)}><path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" /><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12" /><path d="M21 9.5V15" /></svg>
);
export const IconeVideos = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10.5 9.2 4.2 2.8-4.2 2.8V9.2Z" /></svg>
);
export const IconeArtigos = (p: P) => (
  <svg {...base(p)}><path d="M6 3.5h9l3.5 3.5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" /><path d="M14.5 3.5V7.5H18.5" /><path d="M8.5 12h7M8.5 15h7M8.5 18h4" /></svg>
);
export const IconeMateriais = (p: P) => (
  <svg {...base(p)}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13V4Z" /></svg>
);
export const IconeAtlas = (p: P) => (
  <svg {...base(p)}><path d="M12 21c-4.5 0-8-3.2-8-7.4C4 9.5 8 6 12 3c4 3 8 6.500 8 10.600 0 4.200-3.500 7.400-8 7.400Z" /><path d="M12 8v13M12 13l3.500-2.500M12 16.500 8.500 14" /></svg>
);
export const IconeNoticias = (p: P) => (
  <svg {...base(p)}><path d="M5 5h11a1 1 0 0 1 1 1v12.500a1.500 1.500 0 0 0 3 0V9h-3" /><path d="M5 5v13.500A1.500 1.500 0 0 0 6.500 20H18" /><path d="M8 9h6M8 12.500h6M8 16h3" /></svg>
);
