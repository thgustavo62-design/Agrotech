import type { EntradaRecomendacao, Recomendacao } from './tipos.js';
import { MOTOR_VERSAO } from './versao.js';
import { n } from './num.js';
import { calcular } from './calculos.js';
import { calcularCalagem, escolherCorretivo, PRNT_PADRAO } from './calagem.js';
import { avaliarGessagem } from './gessagem.js';
import { calcularAdubacao } from './adubacao.js';
import { fontesSugeridas } from './fontes.js';
import { gerarDiagnostico } from './diagnostico.js';

/**
 * Orquestra o motor inteiro e devolve uma recomendação RASTREÁVEL:
 * carrega a versão do motor e um snapshot das tabelas usadas, para que o
 * resultado continue reproduzível mesmo depois de a organização recalibrar.
 *
 * Função pura: mesma entrada -> mesma saída (exceto `gerada_em`, que pode ser
 * fixada via `agora`).
 */
export function gerarRecomendacao(
  entrada: EntradaRecomendacao,
  agora: Date = new Date(),
): Recomendacao {
  const { analise, cultura, tabelas } = entrada;

  const prnt = n(analise.prnt) || PRNT_PADRAO;
  const incorp = Number.parseInt(String(analise.incorp ?? 20), 10) || 20;
  const area = entrada.areaHa ?? 0;

  const produtividade =
    n(analise.prodEsperada) ||
    entrada.prodEsperadaTalhao ||
    (cultura ? cultura.ref : 0);

  const calculo = calcular(analise, tabelas);
  const calagem = calcularCalagem(analise, calculo, cultura, prnt, incorp);
  const corretivo = escolherCorretivo(analise, calculo);
  const gessagem = avaliarGessagem(analise, calculo);
  const adubacao = calcularAdubacao(analise, calculo, cultura, produtividade);
  const fontes = adubacao ? fontesSugeridas(analise, adubacao, tabelas) : [];
  const diagnostico = gerarDiagnostico(analise, calculo, cultura, tabelas);

  return {
    motor_versao: MOTOR_VERSAO,
    gerada_em: agora.toISOString(),
    calculo,
    calagem,
    corretivo,
    gessagem,
    adubacao,
    fontes,
    diagnostico,
    produtividade,
    areaHa: area,
    totais: {
      calcario_t: calagem.corrigido * area,
      gesso_t: gessagem.precisa ? (gessagem.dose * area) / 1000 : 0,
      N_kg: (adubacao?.N ?? 0) * area,
      P2O5_kg: (adubacao?.P2O5 ?? 0) * area,
      K2O_kg: (adubacao?.K2O ?? 0) * area,
    },
    tabelas_snapshot: JSON.parse(JSON.stringify(tabelas)) as typeof tabelas,
  };
}
