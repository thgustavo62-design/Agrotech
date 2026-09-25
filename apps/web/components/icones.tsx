import type { SVGProps } from 'react';

/**
 * Ícones de linha, minimalistas, sem biblioteca externa — consistentes com o
 * resto do sistema visual (CSS próprio, sem dependência nova). 20×20,
 * stroke="currentColor" para herdar a cor do texto/estado ativo.
 */
type Props = SVGProps<SVGSVGElement>;
const base = (props: Props) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  ...props,
});

export const IconeInicio = (p: Props) => (
  <svg {...base(p)}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /></svg>
);
export const IconePendencia = (p: Props) => (
  <svg {...base(p)}><path d="M12 3 3 20h18L12 3Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></svg>
);
export const IconeAgenda = (p: Props) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /></svg>
);
export const IconeProdutores = (p: Props) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15 20c.2-2.6 1.6-4.4 3.5-4.7" /></svg>
);
export const IconePropriedades = (p: Props) => (
  <svg {...base(p)}><path d="M12 3 4 8v13h16V8L12 3Z" /><path d="M9.5 21v-6h5v6" /></svg>
);
export const IconeTalhoes = (p: Props) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="8" height="8" rx="1.3" /><rect x="12.5" y="3.5" width="8" height="8" rx="1.3" /><rect x="3.5" y="12.5" width="8" height="8" rx="1.3" /><rect x="12.5" y="12.5" width="8" height="8" rx="1.3" /></svg>
);
export const IconeAnalises = (p: Props) => (
  <svg {...base(p)}><path d="M9 3h6" /><path d="M10 3v5.5L4.8 18.2A1.7 1.7 0 0 0 6.3 20.7h11.4a1.7 1.7 0 0 0 1.5-2.5L14 8.5V3" /><path d="M7.5 15h9" /></svg>
);
export const IconeLaudos = (p: Props) => (
  <svg {...base(p)}><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4" /><path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4" /></svg>
);
export const IconeRecomendacoes = (p: Props) => (
  <svg {...base(p)}><rect x="5" y="4" width="14" height="17" rx="1.5" /><path d="M9 3.2h6a1 1 0 0 1 1 1V6H8V4.2a1 1 0 0 1 1-1Z" /><path d="m8.5 12.5 2 2 4.5-4.5" /></svg>
);
export const IconeMonitoramento = (p: Props) => (
  <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconeInteligencia = (p: Props) => (
  <svg {...base(p)}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20.5h19" /></svg>
);
export const IconeRelatorios = (p: Props) => (
  <svg {...base(p)}><path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
);
export const IconeFinanceiro = (p: Props) => (
  <svg {...base(p)}><rect x="3" y="6.5" width="18" height="12" rx="2" /><path d="M3 10.5h18" /><circle cx="7" cy="14.5" r="1" fill="currentColor" stroke="none" /></svg>
);
export const IconeEquipe = (p: Props) => (
  <svg {...base(p)}><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="8.5" r="2.4" /><path d="M2.8 20c.3-3.3 2.6-5.5 5.7-5.5 2.6 0 4.7 1.6 5.4 4" /><path d="M14.7 15.3c2.3.4 3.9 2.1 4.3 4.7" /></svg>
);
export const IconeTabelas = (p: Props) => (
  <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M9 9.5V19.5" /></svg>
);
export const IconeAssinatura = (p: Props) => (
  <svg {...base(p)}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 9.5h18" /><path d="M6.5 14h4" /></svg>
);
export const IconeConfig = (p: Props) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2M12 18.5v2M4.6 6.6l1.4 1.4M18 16l1.4 1.4M3.5 12h2M18.5 12h2M4.6 17.4 6 16M18 8l1.4-1.4" /></svg>
);
export const IconeMais = (p: Props) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></svg>
);
export const IconeBusca = (p: Props) => (
  <svg {...base(p)}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.3-4.3" /></svg>
);
export const IconeFechar = (p: Props) => (
  <svg {...base(p)}><path d="M5 5l14 14M19 5 5 19" /></svg>
);
export const IconeUsuario = (p: Props) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.6-4 3.4-6.5 7.5-6.5s6.9 2.5 7.5 6.5" /></svg>
);
export const IconeEmail = (p: Props) => (
  <svg {...base(p)}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
);
export const IconeCadeado = (p: Props) => (
  <svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" /></svg>
);
export const IconeOlho = (p: Props) => (
  <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconeOlhoFechado = (p: Props) => (
  <svg {...base(p)}><path d="M4 4l16 16" /><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6.1c6 0 9.5 5.9 9.5 5.9a17.6 17.6 0 0 1-3.4 4.1M7.3 7.9C4.6 9.6 2.5 12 2.5 12s3.5 5.9 9.5 5.9c1.3 0 2.5-.3 3.6-.7" /><path d="M9.7 10.3a3 3 0 0 0 4.1 4.1" /></svg>
);

/** Marca oficial do Google ("G" colorido) — símbolo de marca, cores fixas (não herda currentColor). */
export const IconeGoogle = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...p}>
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
  </svg>
);
