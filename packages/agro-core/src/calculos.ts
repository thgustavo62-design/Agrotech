import type { Analise, ResultadoCalculo, TabelasReferencia } from './tipos.js';
import { n, div } from './num.js';
import { classificar, faixaFosforo } from './interpretacao.js';

/** Fatores de conversão de mg/dm³ para cmolc/dm³ (massa equivalente). */
export const CONV = {
  /** K: massa atômica 39,1 g/mol, valência 1 */
  K: 391,
  /** Na: 23,0 g/mol, valência 1 */
  Na: 230,
} as const;

/**
 * Complexo sortivo e relações derivadas.
 *
 *   K (cmolc)  = K (mg/dm³) / 391
 *   Na (cmolc) = Na (mg/dm³) / 230
 *   SB = Ca + Mg + K + Na
 *   t  = SB + Al              (CTC efetiva)
 *   T  = SB + (H+Al)          (CTC a pH 7)
 *   V% = 100 * SB / T
 *   m% = 100 * Al / t
 *
 * Nada aqui lança: entradas ausentes contam como zero.
 */
export function calcular(a: Analise, tab: TabelasReferencia): ResultadoCalculo {
  const Ca = n(a.Ca);
  const Mg = n(a.Mg);
  const Al = n(a.Al);
  const HAl = n(a.HAl);
  const Kc = div(n(a.K), CONV.K);
  const Nac = div(n(a.Na), CONV.Na);

  const SB = Ca + Mg + Kc + Nac;
  const t = SB + Al;
  const T = SB + HAl;
  const V = div(100 * SB, T);
  const m = div(100 * Al, t);

  const faixaP = faixaFosforo(n(a.argila), tab);

  return {
    Kc,
    Nac,
    SB,
    t,
    T,
    V,
    m,
    CaMg: div(Ca, Mg),
    CaK: div(Ca, Kc),
    MgK: div(Mg, Kc),
    partCa: div(100 * Ca, T),
    partMg: div(100 * Mg, T),
    partK: div(100 * Kc, T),
    partHAl: div(100 * HAl, T),
    faixaP,
    classeP: classificar(n(a.P), faixaP.q),
    classeK: classificar(n(a.K), tab.faixas.K.q),
  };
}
