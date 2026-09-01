import type { Analise, Gessagem, ResultadoCalculo } from './tipos.js';
import { n } from './num.js';

/**
 * Gessagem.
 *
 * O sistema NÃO calcula dose de gesso com precisão — apenas INDICA a necessidade
 * de investigar. A decisão real depende da camada de 20-40 cm, que o motor não
 * recebe. A "dose" abaixo é referência grosseira (50 * % argila) e só vale com
 * análise de subsuperfície confirmando Ca < 0,5 ou m > 20% no perfil.
 *
 * Critério de indicação (camada 0-20 cm):
 *   Al > 0,5 cmolc/dm³, ou Ca < 0,5 cmolc/dm³, ou m% > 20
 */
export function avaliarGessagem(a: Analise, r: ResultadoCalculo): Gessagem {
  const argila = n(a.argila);
  const Al = n(a.Al);
  const Ca = n(a.Ca);

  const precisa = Al > 0.5 || Ca < 0.5 || r.m > 20;

  return {
    precisa,
    dose: 50 * argila,
    criterio: precisa
      ? 'Indicado investigar: há alumínio ou baixo Ca na camada superficial. Confirme com análise de 20–40 cm antes de definir dose.'
      : 'Não indicado pela camada 0–20 cm. Só avalie gesso com análise de 20–40 cm mostrando Ca < 0,5 cmolc/dm³ ou m > 20%.',
  };
}
