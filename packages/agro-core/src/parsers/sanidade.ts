import type { ChaveCampoLaudo } from './tipos.js';

/**
 * Faixas fisicamente plausíveis. Valor fora disso NUNCA é aceito
 * automaticamente, mesmo com rótulo perfeito (doc seção 8.4 e auditoria A7).
 */
export const SANIDADE: Record<ChaveCampoLaudo, [number, number]> = {
  ph: [3, 9],
  argila: [0, 100],
  mo: [0, 100],
  p: [0, 500],
  k: [0, 2000],
  na: [0, 2000],
  ca: [0, 30],
  mg: [0, 30],
  al: [0, 30],
  h_al: [0, 50],
  s: [0, 500],
  b: [0, 20],
  zn: [0, 100],
  cu: [0, 100],
  mn: [0, 500],
  fe: [0, 1000],
};

export function dentroDaFaixa(chave: ChaveCampoLaudo, valor: number): boolean {
  const faixa = SANIDADE[chave];
  if (!faixa) return true;
  return valor >= faixa[0] && valor <= faixa[1];
}
