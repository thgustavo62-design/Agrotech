import type { Analise, Gessagem, ResultadoCalculo, SubsuperficieGessagem } from './tipos.js';
import { n } from './num.js';
import { informado, lerNumero } from './validar-analise.js';
import { CONV } from './calculos.js';

/**
 * Gessagem — a DOSE só existe com análise de 20-40 cm.
 *
 * A decisão de aplicar gesso depende do perfil, não da camada superficial. Por isso há três situações:
 *
 *   sem_indicacao             nada na camada 0-20 sugere gesso e não há subsuperfície que o indique
 *   investigar_subsuperficie  a camada 0-20 sugere (Al > 0,5, Ca < 0,5 ou m > 20%) e NÃO há análise de 20-40
 *                             válida: o motor não devolve dose nenhuma (nem "de referência")
 *   aprovada                  a análise de 20-40 confirma (Ca < 0,5 ou m > 20%): dose = 50 × % de argila (kg/ha)
 *
 * Subsuperfície incompleta (falta Ca, Mg, K ou Al) conta como ausente — nunca se completa com zero.
 */

const DOSE_POR_PCT_ARGILA = 50; // kg/ha por % de argila (dose de referência para a camada confirmada)
const CA_MINIMO = 0.5;          // cmolc/dm³
const M_MAXIMO = 20;            // %

const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function avaliarGessagem(a: Analise, r: ResultadoCalculo, sub?: SubsuperficieGessagem | null): Gessagem {
  const Al = n(a.Al);
  const Ca = n(a.Ca);
  const superficieSugere = Al > 0.5 || Ca < CA_MINIMO || r.m > M_MAXIMO;

  if (sub) {
    const leitura = lerSubsuperficie(sub.analise);
    if (leitura.ok) {
      const { Ca: c, m } = leitura;
      const base = { dataColeta: sub.dataColeta ?? null, Ca: c, m };
      if (c < CA_MINIMO || m > M_MAXIMO) {
        const argila = informado(sub.analise.argila) ? n(sub.analise.argila) : n(a.argila);
        return {
          situacao: 'aprovada',
          precisa: true,
          dose: Math.round(DOSE_POR_PCT_ARGILA * argila),
          criterio: `Indicada: a análise de 20–40 cm confirma (Ca ${fmt(c)} cmolc/dm³, m ${fmt(m)}%; limites Ca < ${CA_MINIMO} ou m > ${M_MAXIMO}%). Dose de ${DOSE_POR_PCT_ARGILA} kg/ha por % de argila.`,
          subsuperficie: base,
        };
      }
      return {
        situacao: 'sem_indicacao',
        precisa: false,
        dose: null,
        criterio: `Não indicada: a análise de 20–40 cm não confirma (Ca ${fmt(c)} cmolc/dm³, m ${fmt(m)}%; indicaria Ca < ${CA_MINIMO} ou m > ${M_MAXIMO}%).`,
        subsuperficie: base,
      };
    }
    // existe análise de 20-40, mas não dá para usá-la
    return {
      situacao: superficieSugere ? 'investigar_subsuperficie' : 'sem_indicacao',
      precisa: superficieSugere,
      dose: null,
      criterio: `A análise de 20–40 cm está incompleta (${leitura.faltam.join(', ')}) e não foi usada. ${superficieSugere ? 'A camada de 0–20 cm sugere investigar: complete a análise de 20–40 cm antes de definir gesso.' : 'A camada de 0–20 cm não sugere gesso.'}`,
    };
  }

  if (superficieSugere) {
    return {
      situacao: 'investigar_subsuperficie',
      precisa: true,
      dose: null,
      criterio: 'Investigar: há alumínio ou pouco cálcio na camada de 0–20 cm. Não há dose de gesso sem a análise de 20–40 cm — colete e lance essa amostra para o sistema calcular.',
    };
  }
  return {
    situacao: 'sem_indicacao',
    precisa: false,
    dose: null,
    criterio: 'Não indicada pela camada 0–20 cm. Só avalie gesso com análise de 20–40 cm mostrando Ca < 0,5 cmolc/dm³ ou m > 20%.',
  };
}

/** Ca e m% da subsuperfície, ou o que falta. Ca, Mg, K e Al são necessários (m% = Al ÷ (SB + Al)). */
function lerSubsuperficie(a: Analise): { ok: true; Ca: number; m: number } | { ok: false; faltam: string[] } {
  const faltam: string[] = [];
  const num = (k: 'Ca' | 'Mg' | 'K' | 'Al') => {
    const x = informado(a[k]) ? lerNumero(a[k]) : null;
    if (x === null || x < 0) faltam.push(k);
    return x ?? 0;
  };
  const Ca = num('Ca'), Mg = num('Mg'), K = num('K'), Al = num('Al');
  if (faltam.length) return { ok: false, faltam };
  const SB = Ca + Mg + K / CONV.K + n(a.Na) / CONV.Na;
  const t = SB + Al;
  return { ok: true, Ca, m: t > 0 ? (100 * Al) / t : 0 };
}

/** Situação de uma gessagem salva ANTES desta regra (sem `situacao`): a dose antiga nunca é tratada como prescrição. */
export function situacaoDaGessagem(g: { situacao?: string; precisa?: boolean }): 'sem_indicacao' | 'investigar_subsuperficie' | 'aprovada' {
  if (g.situacao === 'aprovada' || g.situacao === 'investigar_subsuperficie' || g.situacao === 'sem_indicacao') return g.situacao;
  return g.precisa ? 'investigar_subsuperficie' : 'sem_indicacao';
}

export interface ResumoGessagem {
  situacao: 'sem_indicacao' | 'investigar_subsuperficie' | 'aprovada';
  /** a linha de gesso aparece no laudo (só quando há algo a fazer) */
  mostrar: boolean;
  valor: string;
  detalhe: string;
}

/** O MESMO texto na tela, no laudo impresso, no PDF e no link do produtor: ninguém lê dose onde outro lê "investigar". */
export function resumoGessagem(g: { situacao?: string; precisa?: boolean; dose?: number | null }): ResumoGessagem {
  const situacao = situacaoDaGessagem(g);
  if (situacao === 'aprovada' && typeof g.dose === 'number') {
    return { situacao, mostrar: true, valor: `${g.dose.toLocaleString('pt-BR')} kg/ha`, detalhe: `${DOSE_POR_PCT_ARGILA} kg/ha por % de argila · confirmada por análise de 20–40 cm` };
  }
  if (situacao === 'sem_indicacao') return { situacao, mostrar: false, valor: '—', detalhe: 'sem indicação' };
  return { situacao: 'investigar_subsuperficie', mostrar: true, valor: 'investigar', detalhe: 'sem dose: exige análise de 20–40 cm' };
}
