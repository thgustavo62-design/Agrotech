import { PADRAO, type Analise, type Cultura } from '@agrotech/agro-core';

/** Chaves de cultura na ordem de exibição. */
export const CULTURAS = Object.keys(PADRAO.culturas);

/** Nome legível da cultura (curto, sem o " – produção"). */
export function nomeCultura(chave: string | null | undefined): string {
  if (!chave) return 'Sem cultura';
  const c = PADRAO.culturas[chave];
  return c ? c.nome.split(' –')[0]! : chave;
}

export function culturaDe(chave: string | null | undefined): Cultura | undefined {
  return chave ? PADRAO.culturas[chave] : undefined;
}

/** Linha "solta" de análise (do banco ou do payload público). */
export interface LinhaAnaliseCrua {
  argila?: unknown; ph?: unknown; mo?: unknown; p?: unknown; k?: unknown; na?: unknown;
  ca?: unknown; mg?: unknown; al?: unknown; h_al?: unknown; s?: unknown;
  b?: unknown; zn?: unknown; cu?: unknown; mn?: unknown; fe?: unknown;
  prnt?: unknown; incorporacao?: unknown; prod_esperada?: unknown;
}

const val = (v: unknown): number | string | null => {
  if (v == null) return null;
  return typeof v === 'number' ? v : String(v);
};

/** Converte a linha do banco (ou do payload público) para o formato do motor. */
export function paraAnalise(r: LinhaAnaliseCrua): Analise {
  return {
    argila: val(r.argila), pH: val(r.ph), MO: val(r.mo), P: val(r.p),
    K: val(r.k), Na: val(r.na), Ca: val(r.ca), Mg: val(r.mg),
    Al: val(r.al), HAl: val(r.h_al), S: val(r.s),
    B: val(r.b), Zn: val(r.zn), Cu: val(r.cu), Mn: val(r.mn), Fe: val(r.fe),
    prnt: val(r.prnt), incorp: val(r.incorporacao), prodEsperada: val(r.prod_esperada),
  };
}
