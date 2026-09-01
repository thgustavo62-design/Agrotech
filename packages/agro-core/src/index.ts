/**
 * @agrotech/agro-core — motor agronômico do AgroTech.
 *
 * Funções puras: recebem números e tabelas, devolvem números. Sem DOM, sem
 * banco, sem rede. O mesmo código roda no navegador, na Edge Function e nos
 * testes.
 */

export { MOTOR_VERSAO } from './versao.js';
export * from './tipos.js';

export { n, arred, limitar, div } from './num.js';
export { f0, f1, f2 } from './formato.js';

export { PADRAO, clonarPadrao } from './tabelas/index.js';

export {
  NOMES_CLASSE, NOMES_INV,
  classificar, faixaFosforo, classeDe, nomeClasse, ehLimitante,
} from './interpretacao.js';

export { CONV, calcular } from './calculos.js';

export {
  V2_PADRAO, M_MAX_PADRAO, PRNT_PADRAO,
  fatorY, fatorProfundidade, calcularCalagem, escolherCorretivo, nomeCorretivo,
} from './calagem.js';

export { avaliarGessagem } from './gessagem.js';
export { calcularAdubacao } from './adubacao.js';
export { fontesSugeridas } from './fontes.js';
export { gerarDiagnostico } from './diagnostico.js';
export { gerarRecomendacao } from './recomendacao.js';

export * as parsers from './parsers/index.js';
