import type { Analise } from '../../src/tipos.js';

/**
 * Caso real anonimizado: latossolo vermelho-amarelo ácido de meia encosta,
 * café conilon, região de Colatina/ES. Camada 0-20 cm.
 * Foi este caso que expôs o erro de escolha do corretivo (auditoria A1).
 */
export const LATOSSOLO_COLATINA: Analise = {
  argila: '42',
  pH: '4,8',
  MO: '1,9',
  P: '4,0',
  K: '40',
  Na: '0',
  Ca: '1,2',
  Mg: '0,3',
  Al: '1,1',
  HAl: '6,5',
  S: '4',
  B: '0,2',
  Zn: '0,6',
  Cu: '0,8',
  Mn: '6',
  Fe: '30',
  prnt: '80',
  incorp: '20',
};

/** Solo corrigido, sem limitação química relevante — diagnóstico deve dar "ok". */
export const SOLO_BOM: Analise = {
  argila: '30',
  pH: '6,2',
  MO: '3,5',
  P: '25',
  K: '90',
  Na: '0',
  Ca: '3,5',
  Mg: '1,2',
  Al: '0',
  HAl: '2,0',
  S: '12',
  B: '0,6',
  Zn: '1,6',
  Cu: '1,0',
  Mn: '8',
  Fe: '25',
  prnt: '90',
  incorp: '20',
};

/** Laudo em texto, no formato "rótulo .... valor unidade" (um por linha). */
export const LAUDO_TEXTO_MEHLICH = `
Laboratório de Solos — Análise de rotina (extrator Mehlich-1)
Cliente: Fazenda Boa Vista
Propriedade: Sítio Água Limpa
Amostra: Talhão 3 - conilon
Protocolo: 2026-04477
Data de coleta: 12/03/2026
Profundidade: 0-20 cm

pH em água ............... 4,8
M.O. ..................... 1,9 dag/kg
P (Mehlich) .............. 4,0 mg/dm3
K ....................... 40 mg/dm3
Ca2+ .................... 1,20 cmolc/dm3
Mg2+ .................... 0,30 cmolc/dm3
Al3+ .................... 1,10 cmolc/dm3
H+Al .................... 6,50 cmolc/dm3
S ...................... 4,0 mg/dm3
B ...................... 0,20 mg/dm3
Zn .................... 0,60 mg/dm3
Cu .................... 0,80 mg/dm3
Mn .................... 6,0 mg/dm3
Fe .................... 30 mg/dm3
Argila ................. 42 %
`;

/** Mesmo laudo, mas com K impresso em cmolc/dm3 (converter x391) e C.O. no lugar de M.O. */
export const LAUDO_TEXTO_K_CMOLC = `
Análise de solo — método Mehlich, resultados em cmolc/dm3
Carbono orgânico ......... 1,10 dag/kg
K ....................... 0,102 cmolc/dm3
Ca2+ .................... 1,20 cmolc/dm3
Mg2+ .................... 0,30 cmolc/dm3
H+Al ................... 6,50 cmolc/dm3
Argila ................. 42 %
`;

/** Laudo com um valor impossível — o parser tem que rejeitar, não "corrigir". */
export const LAUDO_TEXTO_ABSURDO = `
Análise Mehlich, unidades em cmolc/dm3
pH em água ............... 42
Ca2+ .................... 1,20 cmolc/dm3
Mg2+ .................... 0,30 cmolc/dm3
H+Al ................... 6,50 cmolc/dm3
`;
