import type { SupabaseClient } from '@supabase/supabase-js';

export const ROTULO_TIPO_NOTIFICACAO: Record<string, string> = {
  nova_recomendacao: 'Recomendação',
  nova_analise: 'Análise',
  visita_agendada: 'Visita agendada',
  visita_realizada: 'Visita realizada',
  documento_disponivel: 'Documento',
  atividade_vencendo: 'Atividade',
  conta_vencendo: 'Financeiro',
  conteudo_indicado: 'Academy',
  atendimento_novo: 'Connect · novo pedido',
  atendimento_atribuido: 'Connect · atribuído a você',
  atendimento_resposta: 'Connect · resposta',
  atendimento_status: 'Connect · situação do pedido',
};

/** Contagem de não lidas do usuário logado — usada no sino do cabeçalho (consultor e produtor). */
export async function contarNaoLidas(sb: SupabaseClient): Promise<number> {
  const { count } = await sb
    .schema('agro')
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .is('lida_em', null);
  return count ?? 0;
}
