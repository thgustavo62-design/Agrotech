import { PADRAO, type Analise } from '@agrotech/agro-core';

/**
 * Dados de demonstração para a vitrine /demo (sem banco, sem auth).
 * Mesmo caso da fixture de teste do agro-core: latossolo ácido de meia encosta,
 * café conilon, região de Colatina/ES.
 */
export const ANALISE_DEMO: Analise = {
  argila: '42', pH: '4,8', MO: '1,9', P: '4,0', K: '40', Na: '0',
  Ca: '1,2', Mg: '0,3', Al: '1,1', HAl: '6,5',
  S: '4', B: '0,2', Zn: '0,6', Cu: '0,8', Mn: '6', Fe: '30',
  prnt: '80', incorp: '20',
};

export const CONTEXTO_DEMO = {
  produtor: 'Fazenda Boa Vista',
  talhao: 'Talhão 3 — conilon',
  areaHa: 5,
  data: '12/03/2026',
  profundidade: '0–20',
  prodEsperadaTalhao: 65,
};

export const CULTURA_DEMO = PADRAO.culturas['cafe-conilon'];
export const TABELAS_DEMO = PADRAO;
