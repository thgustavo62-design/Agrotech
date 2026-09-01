import type { Adubacao, Analise, Cultura, ResultadoCalculo } from './tipos.js';
import { arred } from './num.js';

/**
 * Adubação NPK.
 *
 *   fator = produtividade_esperada / produtividade_referência
 *   N     = N_referência * fator
 *   P2O5  = P_tabela[classe_de_P_do_solo] * fator
 *   K2O   = K_tabela[classe_de_K_do_solo] * fator
 *
 * Modelo deliberadamente transparente: N escala com a expectativa de
 * produtividade; P e K partem da classe de fertilidade e escalam junto.
 *
 * AUDITORIA A11 (pendente por decisão): para pastagem (UA/ha) a
 * proporcionalidade do N é mais frouxa. A fórmula é a mesma; o valor fica
 * editável na tabela da organização. Revisar quando houver dado de campo.
 */
export function calcularAdubacao(
  _a: Analise,
  r: ResultadoCalculo,
  cultura: Cultura | undefined,
  prodEsperada: number,
): Adubacao | null {
  if (!cultura) return null;

  const fator = cultura.ref > 0 && prodEsperada > 0 ? prodEsperada / cultura.ref : 1;

  const pRef = cultura.P[r.classeP] ?? 0;
  const kRef = cultura.K[r.classeK] ?? 0;

  return {
    N: arred(cultura.N * fator),
    P2O5: arred(pRef * fator),
    K2O: arred(kRef * fator),
    fator,
    classeP: r.classeP,
    classeK: r.classeK,
  };
}
