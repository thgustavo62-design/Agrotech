/**
 * Rótulos e links da trilha de auditoria (`agro.audit_log`), compartilhados
 * entre o painel (`/app`) e a Visão 360º do produtor (`/app/produtores/[id]`,
 * aba Linha do tempo) — mesma fonte, duas telas.
 */

export interface AtividadeBruta {
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  dados: Record<string, unknown> | null;
  criado_em: string;
}

export const ROTULO_ATIVIDADE: Record<string, (d: Record<string, unknown>) => string> = {
  'analise.criada': () => 'Análise de solo lançada manualmente',
  'laudo.enviado': (d) => `Laudo em PDF enviado${d.nome_arquivo ? ` — ${d.nome_arquivo}` : ''}`,
  'laudo.confirmado': () => 'Laudo conferido e confirmado — virou análise',
  'laudo.descartado': () => 'Laudo descartado na conferência',
  'recomendacao.emitida': () => 'Recomendação emitida',
  'produtor.criado': () => 'Produtor cadastrado',
  'produtor.editado': () => 'Cadastro de produtor atualizado',
  'produtor.convidado': (d) => `Convite de acesso enviado ao produtor${d.email ? ` (${d.email})` : ''}`,
  'produtor.dados_exportados': () => 'Dados do produtor exportados (LGPD)',
  'produtor.excluido_lgpd': () => 'Produtor excluído a pedido (LGPD)',
  'talhao.criado': () => 'Talhão cadastrado',
  'talhao.editado': () => 'Talhão atualizado',
  'compartilhamento.criado': () => 'Link de resultados gerado para o produtor',
  'perfil.editado': () => 'Perfil do consultor atualizado',
};

export function rotuloAtividade(a: AtividadeBruta): string {
  return ROTULO_ATIVIDADE[a.acao]?.(a.dados ?? {}) ?? a.acao;
}

export function linkAtividade(a: AtividadeBruta): string | undefined {
  const dados = a.dados ?? {};
  if (a.acao === 'recomendacao.emitida' && typeof dados.analise_id === 'string') {
    return `/app/analises/${dados.analise_id}/laudo`;
  }
  if (!a.entidade_id) return undefined;
  if (a.entidade === 'produtores') return `/app/produtores/${a.entidade_id}`;
  if (a.entidade === 'talhoes') return `/app/talhoes/${a.entidade_id}`;
  if (a.entidade === 'analises') return `/app/analises/${a.entidade_id}`;
  if (a.entidade === 'documentos') return `/app/laudos/${a.entidade_id}`;
  return undefined;
}
