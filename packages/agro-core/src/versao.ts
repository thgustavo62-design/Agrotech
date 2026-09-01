/**
 * Versão do motor agronômico.
 *
 * Toda recomendação gravada carrega este valor em `motor_versao`, junto de um
 * snapshot das tabelas de referência. Assim uma recomendação emitida hoje
 * continua reproduzível anos depois, mesmo que as tabelas mudem.
 *
 * Regra: mudou fórmula, faixa de interpretação ou regra de decisão -> bump.
 *   - patch: correção sem mudar resultado esperado de casos válidos
 *   - minor: nova saída / novo parâmetro, retrocompatível
 *   - major: mudança que altera recomendações já emitidas
 */
export const MOTOR_VERSAO = '0.1.0';
