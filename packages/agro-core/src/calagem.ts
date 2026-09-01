import type {
  Analise, Calagem, Corretivo, EscolhaCorretivo, Cultura, ResultadoCalculo,
} from './tipos.js';
import { n } from './num.js';
import { f1 } from './formato.js';

/** V% desejado quando não há cultura definida. */
export const V2_PADRAO = 60;
/** m% máximo tolerado quando não há cultura definida. */
export const M_MAX_PADRAO = 20;
/** PRNT assumido quando não informado, %. */
export const PRNT_PADRAO = 85;

/** Fator Y da textura para o método de neutralização do alumínio. */
export function fatorY(argilaPct: number): 1 | 2 | 3 | 4 {
  if (argilaPct >= 60) return 4;
  if (argilaPct >= 35) return 3;
  if (argilaPct >= 15) return 2;
  return 1;
}

/** Fator de profundidade de incorporação: 0-20 => 1,0 · 0-30 => 1,5 · 0-40 => 2,0. */
export function fatorProfundidade(incorpCm: number): number {
  if (incorpCm >= 40) return 2;
  if (incorpCm >= 30) return 1.5;
  return 1;
}

/**
 * Necessidade de calagem pelos dois métodos, em paralelo. O sistema ADOTA O MAIOR.
 *
 * Saturação por bases:
 *   NC = (V2 - V) * T / 100
 *
 * Neutralização do Al + elevação de Ca e Mg:
 *   NC = Y * [Al - (m_max * t / 100)] + [2 - (Ca + Mg)]
 *
 * Correção para o produto real:
 *   dose = NC * (100 / PRNT) * fator_profundidade
 */
export function calcularCalagem(
  a: Analise,
  r: ResultadoCalculo,
  cultura: Cultura | undefined,
  prnt = PRNT_PADRAO,
  incorpCm = 20,
): Calagem {
  const V2 = cultura?.V2 ?? V2_PADRAO;
  const mMax = cultura?.m_max ?? M_MAX_PADRAO;
  const argila = n(a.argila);
  const Ca = n(a.Ca);
  const Mg = n(a.Mg);
  const Al = n(a.Al);

  const fatorProf = fatorProfundidade(incorpCm);
  const Y = fatorY(argila);

  const nc_sb = Math.max(0, ((V2 - r.V) * r.T) / 100);
  const nc_al =
    Math.max(0, Y * (Al - (mMax * r.t) / 100)) +
    Math.max(0, 2 - (Ca + Mg));

  const escolhido = Math.max(nc_sb, nc_al);
  const prntEfetivo = prnt > 0 ? prnt : PRNT_PADRAO;
  const corrigido = (escolhido * (100 / prntEfetivo)) * fatorProf;

  return { V2, nc_sb, nc_al, Y, escolhido, corrigido, fatorProf };
}

/**
 * Escolha do corretivo pela relação Ca/Mg e pelo Mg absoluto.
 *
 * AUDITORIA A1 — no protótipo esta regra estava INVERTIDA: Ca/Mg abaixo de 3:1
 * recomendava dolomítico. Errado: Ca/Mg baixo é Mg sobrando; dolomítico (fonte
 * de Mg) agrava. A relação larga (muito Ca, pouco Mg) é que pede dolomítico.
 *
 * Regra corrigida — olha o Mg absoluto ANTES da relação:
 *   Mg < 0,9 cmolc/dm³, ou Ca/Mg > 4:1  -> dolomítico
 *   Ca/Mg < 2:1                          -> calcítico
 *   entre 2:1 e 4:1 com Mg adequado      -> magnesiano
 */
export function escolherCorretivo(a: Analise, r: ResultadoCalculo): EscolhaCorretivo {
  const Mg = n(a.Mg);
  const caMg = r.CaMg;

  if (Mg <= 0) {
    return {
      corretivo: 'magnesiano',
      motivo: 'Mg não informado na análise — refazer a escolha com o valor de Mg. Magnesiano é a opção conservadora.',
    };
  }

  let corretivo: Corretivo;
  let motivo: string;

  if (Mg < 0.9 || caMg > 4) {
    corretivo = 'dolomitico';
    motivo =
      Mg < 0.9
        ? `Mg baixo (${f1(Mg)} cmolc/dm³): elevar magnésio junto com o cálcio.`
        : `Ca/Mg alto (${f1(caMg)}:1): muito cálcio para pouco magnésio.`;
  } else if (caMg < 2) {
    corretivo = 'calcitico';
    motivo = `Ca/Mg baixo (${f1(caMg)}:1): magnésio em excesso relativo, não adicionar mais Mg.`;
  } else {
    corretivo = 'magnesiano';
    motivo = `Ca/Mg equilibrado (${f1(caMg)}:1) e Mg adequado (${f1(Mg)} cmolc/dm³).`;
  }

  return { corretivo, motivo };
}

/** Rótulo pronto para laudo. */
export function nomeCorretivo(c: Corretivo): string {
  return { calcitico: 'Calcário calcítico', magnesiano: 'Calcário magnesiano', dolomitico: 'Calcário dolomítico' }[c];
}
