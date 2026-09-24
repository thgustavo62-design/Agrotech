import type { SupabaseClient } from '@supabase/supabase-js';

/** Constantes e pequenas regras do financeiro do produtor, compartilhadas entre as abas. */

export type StatusLancamento = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

export const ROTULO_STATUS_LANCAMENTO: Record<StatusLancamento, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  pendente: { txt: 'a vencer', tom: 'cinza' },
  pago: { txt: 'pago', tom: 'ok' },
  atrasado: { txt: 'atrasado', tom: 'ruim' },
  cancelado: { txt: 'cancelado', tom: 'cinza' },
};

/**
 * Não há job de fundo virando `pendente` em `atrasado` — o status gravado no
 * banco só muda quando o próprio produtor marca. Este cálculo é só de
 * apresentação: um lançamento pendente com vencimento no passado aparece
 * como "atrasado" na tela sem precisar de um cron novo.
 */
export function statusEfetivo(status: string, vencimento: string | null, hojeISO: string): StatusLancamento {
  if (status === 'pendente' && vencimento && vencimento < hojeISO) return 'atrasado';
  return status as StatusLancamento;
}

export const NOME_TIPO_CONTA: Record<string, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa',
  outro: 'Outro',
};

/** Resumo leve para o card "Resumo financeiro" do dashboard do produtor — não recalcula tudo que a aba Financeiro mostra. */
export async function resumoFinanceiro(sb: SupabaseClient, produtorId: string) {
  const [{ data: contas }, { data: lancamentos }] = await Promise.all([
    sb.schema('agro').from('financeiro_contas').select('saldo_inicial').eq('produtor_id', produtorId),
    sb.schema('agro').from('financeiro_lancamentos').select('tipo, valor, status, vencimento').eq('produtor_id', produtorId),
  ]);

  const totalContas = (contas ?? []).reduce((s: number, c: { saldo_inicial: number }) => s + Number(c.saldo_inicial), 0);
  const lista = (lancamentos ?? []) as Array<{ tipo: string; valor: number; status: string; vencimento: string | null }>;
  const receitas = lista.filter((l) => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const despesas = lista.filter((l) => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const pendencias = lista.filter((l) => l.status === 'pendente' || l.status === 'atrasado').length;

  return { saldo: totalContas + receitas - despesas, pendencias };
}
