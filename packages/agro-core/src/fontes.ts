import type { Adubacao, Analise, Fonte, TabelasReferencia } from './tipos.js';
import { n } from './num.js';

/**
 * Conversão da recomendação de nutriente em produto comercial.
 *
 *   kg de produto/ha = kg do nutriente/ha / (% de garantia / 100)
 *
 * A escolha da fonte é condicional:
 *   - enxofre baixo  -> superfosfato simples + sulfato de amônio (trazem S)
 *   - enxofre ok     -> superfosfato triplo + ureia (mais concentrados)
 *   - B / Zn baixos  -> entram automaticamente
 */
export function fontesSugeridas(
  a: Analise,
  ad: Adubacao,
  tab: TabelasReferencia,
): Fonte[] {
  const l: Fonte[] = [];
  const limiteBaixo = (chave: 'S' | 'B' | 'Zn') => tab.faixas[chave].q?.[1] ?? 0;
  const sBaixo = n(a.S) <= limiteBaixo('S');

  if (ad.P2O5 > 0) {
    l.push(
      sBaixo
        ? { nome: 'Superfosfato simples (18% P₂O₅)', dose: ad.P2O5 / 0.18, obs: 'traz 16% Ca e 10% S – corrige o enxofre baixo' }
        : { nome: 'Superfosfato triplo (41% P₂O₅)', dose: ad.P2O5 / 0.41, obs: 'maior concentração, menor frete' },
    );
  }

  if (ad.K2O > 0) {
    l.push({
      nome: 'Cloreto de potássio (60% K₂O)',
      dose: ad.K2O / 0.6,
      obs: 'parcelar; evitar mais de 60 kg/ha de K₂O em contato com a semente ou muda',
    });
  }

  if (ad.N > 0) {
    l.push(
      sBaixo
        ? { nome: 'Sulfato de amônio (20% N)', dose: ad.N / 0.2, obs: 'fonte de N e S; acidifica o solo, considerar na calagem' }
        : { nome: 'Ureia (45% N)', dose: ad.N / 0.45, obs: 'incorporar ou aplicar antes da chuva para reduzir volatilização' },
    );
  }

  if (n(a.B) <= limiteBaixo('B')) {
    l.push({ nome: 'Ácido bórico (17% B)', dose: 2 / 0.17, obs: '2 kg/ha de B via solo, ou aplicação foliar parcelada' });
  }

  if (n(a.Zn) <= limiteBaixo('Zn')) {
    l.push({ nome: 'Sulfato de zinco (20% Zn)', dose: 5 / 0.2, obs: '5 kg/ha de Zn via solo, junto com o fosfatado' });
  }

  return l;
}
