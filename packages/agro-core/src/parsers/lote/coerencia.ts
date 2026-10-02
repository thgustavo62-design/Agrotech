import type { AmostraLaudo, ChaveCampoLaudo } from '../tipos.js';
import type { Candidato } from './tipos.js';

/** Conferência pela aritmética do próprio laudo (SB = Ca+Mg+K/391, T = SB+H+Al). */

export const K_MG_POR_CMOLC = 391;

/**
 * SB e T são totais impressos que o OCR lê mal ("5,17" por "5,77"). Em vez de deixar a
 * maioria decidir, usa a conta: entre as leituras de SB, vale a que fecha com Ca+Mg+K/391
 * (e a de T que fecha com SB + H+Al). Só vence a leitura que a aritmética confirma.
 */
export function arbitrarTotais(
  campos: AmostraLaudo['campos'],
  extras: AmostraLaudo['extras'],
  cands: Record<string, Candidato[]>,
): void {
  const v = (k: ChaveCampoLaudo) => campos[k]?.valor ?? null;
  const escolher = (chave: string, esperado: number, origem: string) => {
    const bate = (cands[chave] ?? []).find((c) => Math.abs(c.valor - esperado) <= 0.03);
    if (bate) extras[chave] = { valor: bate.valor, confianca: 0.95, origem };
  };
  const ca = v('ca'), mg = v('mg'), k = v('k'), hal = v('h_al');
  if (ca !== null && mg !== null && k !== null) {
    escolher('sb', ca + mg + k / K_MG_POR_CMOLC, 'OCR: leitura que fecha com Ca+Mg+K');
  }
  const sb = extras['sb']?.valor ?? null;
  if (sb !== null && hal !== null) escolher('t_ctc', sb + hal, 'OCR: leitura que fecha com SB+H+Al');
}

/**
 * O laudo imprime SB e T, que dependem dos próprios valores lidos:
 *   SB = Ca + Mg + K/391        T = SB + (H+Al)
 * Se batem, a leitura de Ca/Mg/K/H+Al ganha confiança; se não, todos caem para 0,6 e
 * o aviso diz qual conta falhou — erro de OCR (ou de digitação do laboratório) fica visível.
 */
export function conferirCoerencia(a: AmostraLaudo, avisos: string[]): void {
  const v = (k: string) => a.campos[k as ChaveCampoLaudo]?.valor ?? null;
  const ca = v('ca'), mg = v('mg'), k = v('k'), hal = v('h_al');
  const sb = a.extras['sb']?.valor ?? null;
  const t = a.extras['t_ctc']?.valor ?? null;
  const marcar = (chaves: ChaveCampoLaudo[], bate: boolean) => {
    for (const ch of chaves) {
      const c = a.campos[ch];
      if (!c || c.valor === null) continue;
      c.confianca = bate ? Math.max(c.confianca, 0.95) : Math.min(c.confianca, 0.6);
      c.origem += bate ? ' · confere com a soma de bases do laudo' : ' · NÃO confere com a soma de bases do laudo';
    }
  };

  let sbCalc: number | null = null;
  if (ca !== null && mg !== null && k !== null) {
    sbCalc = ca + mg + k / K_MG_POR_CMOLC;
    if (sb !== null) {
      const bate = Math.abs(sbCalc - sb) <= 0.03;
      marcar(['ca', 'mg', 'k'], bate);
      if (!bate) avisos.push(`Amostra ${a.indice}: SB impresso ${sb} ≠ Ca+Mg+K = ${sbCalc.toFixed(2)} — confira Ca, Mg e K.`);
    }
  }
  const sbRef = sb ?? sbCalc;
  if (sbRef !== null && hal !== null && t !== null) {
    const bate = Math.abs(sbRef + hal - t) <= 0.03;
    marcar(['h_al'], bate);
    if (!bate) avisos.push(`Amostra ${a.indice}: T impresso ${t} ≠ SB + H+Al = ${(sbRef + hal).toFixed(2)} — confira H+Al.`);
  }
}
