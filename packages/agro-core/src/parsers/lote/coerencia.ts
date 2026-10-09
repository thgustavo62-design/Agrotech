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
      // A conta fecha com folga de ±0,03: confirma um valor em que as leituras concordam, mas NÃO consegue apagar um desacordo
      // entre leituras (1,25 e 1,26 fecham a mesma soma). Com desacordo, o valor segue marcado para conferência.
      const comDesacordo = /\(outras:/.test(c.origem);
      c.confianca = bate ? (comDesacordo ? c.confianca : Math.max(c.confianca, 0.95)) : Math.min(c.confianca, 0.6);
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

/**
 * Faixas em que um solo agrícola brasileiro costuma cair. Fora delas o valor ainda é POSSÍVEL (a faixa de sanidade só barra o
 * impossível), mas é exatamente onde um dígito perdido ou trocado do OCR aparece ("93,18" lido "193,18"; "14,75" lido "74,75").
 * Não rejeita nada: derruba a confiança para o valor ir marcado para conferência.
 */
export const FAIXA_USUAL: Partial<Record<ChaveCampoLaudo, [number, number]>> = {
  ph: [4, 8], mo: [0.3, 8], p: [0.5, 200], k: [10, 600], ca: [0.1, 15], mg: [0.05, 6], al: [0, 3],
  h_al: [0.2, 15], s: [1, 80], b: [0.05, 3], fe: [2, 300], cu: [0.1, 15], mn: [1, 300], zn: [0.1, 30],
};

export function marcarValoresIncomuns(a: AmostraLaudo, avisos: string[]): void {
  for (const [chave, faixa] of Object.entries(FAIXA_USUAL) as Array<[ChaveCampoLaudo, [number, number]]>) {
    const c = a.campos[chave];
    if (!c || c.valor === null) continue;
    if (c.valor >= faixa[0] && c.valor <= faixa[1]) continue;
    c.confianca = Math.min(c.confianca, 0.6);
    c.origem += ' · valor fora do que é comum em solo — confira com o laudo';
    avisos.push(`Amostra ${a.indice}: ${chave} ${c.valor} é incomum (esperado entre ${faixa[0]} e ${faixa[1]}) — confira com o laudo.`);
  }
}

/**
 * Identidades que o laudo imprime além de SB e T: V% = SB/T·100, t = SB + Al, m% = Al/t·100, e o pH em CaCl₂ que anda de
 * 0,2 a 1,2 abaixo do pH em água. Cada uma que NÃO fecha derruba a confiança dos campos envolvidos (nunca eleva: elas só
 * têm a resolução do arredondamento impresso, não distinguem erros pequenos).
 */
export function conferirIdentidades(a: AmostraLaudo, avisos: string[]): void {
  const campo = (k: string) => a.campos[k as ChaveCampoLaudo]?.valor ?? null;
  const extra = (k: string) => a.extras[k]?.valor ?? null;
  const derrubar = (chaves: ChaveCampoLaudo[], motivo: string) => {
    for (const ch of chaves) {
      const c = a.campos[ch];
      if (!c || c.valor === null) continue;
      c.confianca = Math.min(c.confianca, 0.6);
      c.origem += ` · ${motivo}`;
    }
    avisos.push(`Amostra ${a.indice}: ${motivo} — confira ${chaves.join(', ')}.`);
  };
  const sb = extra('sb'), t = extra('t_ctc'), v = extra('v_pct'), m = extra('m_pct'), tef = extra('t_efetiva');
  const al = campo('al'), ph = campo('ph'), phCa = extra('ph_cacl2');

  if (sb !== null && t !== null && v !== null && t > 0 && Math.abs((sb / t) * 100 - v) > 0.8) {
    derrubar(['ca', 'mg', 'k', 'h_al'], `V% impresso ${v} ≠ SB/T = ${((sb / t) * 100).toFixed(1)}`);
  }
  if (sb !== null && al !== null && tef !== null && Math.abs(sb + al - tef) > 0.05) {
    derrubar(['al', 'ca', 'mg', 'k'], `t impressa ${tef} ≠ SB + Al = ${(sb + al).toFixed(2)}`);
  }
  const tRef = tef ?? (sb !== null && al !== null ? sb + al : null);
  if (al !== null && tRef !== null && tRef > 0 && m !== null && Math.abs((al / tRef) * 100 - m) > 0.8) {
    derrubar(['al'], `m% impresso ${m} ≠ Al/t = ${((al / tRef) * 100).toFixed(1)}`);
  }
  if (ph !== null && phCa !== null && (ph - phCa < 0.1 || ph - phCa > 1.5)) {
    derrubar(['ph'], `pH em água ${ph} e em CaCl₂ ${phCa} não combinam (a diferença usual é de 0,2 a 1,2)`);
  }
}
