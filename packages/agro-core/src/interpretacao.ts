import type {
  ChaveFaixa, FaixaFosforo, IndiceClasse, TabelasReferencia,
} from './tipos.js';
import { n } from './num.js';

export const NOMES_CLASSE = ['Muito baixo', 'Baixo', 'Médio', 'Bom', 'Muito bom'] as const;
export const NOMES_INV = ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'] as const;

/**
 * Classifica `v` em uma das 5 classes definidas por 4 pontos de quebra.
 *
 * Convenção (auditoria A-INT-1): valor EXATAMENTE sobre a quebra permanece na
 * classe inferior — o limite superior é fechado. Ex.: com q=[15,40,70,120],
 * v=40 => classe 1 (baixo), não 2.
 */
export function classificar(
  v: number,
  quebras: readonly number[] | null | undefined,
): IndiceClasse {
  if (!quebras || quebras.length === 0) return 0;
  let i = 0;
  while (i < quebras.length && v > (quebras[i] as number)) i++;
  return Math.min(i, 4) as IndiceClasse;
}

/** Escolhe a faixa de fósforo pela classe de argila (%). */
export function faixaFosforo(argila: number, tab: TabelasReferencia): FaixaFosforo {
  const lista = tab.fosforo;
  const achada = lista.find((x) => argila >= x.min);
  return achada ?? (lista[lista.length - 1] as FaixaFosforo);
}

/** Classe de um parâmetro genérico usando a faixa cadastrada. P precisa de argila. */
export function classeDe(
  chave: ChaveFaixa,
  valor: number,
  tab: TabelasReferencia,
  argila = 0,
): IndiceClasse {
  if (chave === 'P') {
    return classificar(valor, faixaFosforo(argila, tab).q);
  }
  return classificar(valor, tab.faixas[chave].q);
}

/**
 * Nome legível da classe. Para parâmetros invertidos (Al, H+Al, m%) a classe 3/4
 * é "Alto"/"Muito alto", não "Bom"/"Muito bom".
 */
export function nomeClasse(indice: IndiceClasse, invertido = false): string {
  return (invertido ? NOMES_INV : NOMES_CLASSE)[indice] as string;
}

/** true quando o parâmetro está numa das duas classes mais baixas de suficiência. */
export function ehLimitante(indice: IndiceClasse): boolean {
  return indice <= 1;
}

/** Valor cru de `n()` só para reuso sem reimportar em cada módulo. */
export const num = n;
