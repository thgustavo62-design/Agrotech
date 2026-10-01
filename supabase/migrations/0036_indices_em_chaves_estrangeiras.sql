-- 0036 — índices nas chaves estrangeiras que não tinham
-- Achado de auditoria (consulta ao catálogo): 30 colunas com FK sem índice. Sem ele, apagar um
-- usuário/produtor/talhão (inclusive a exclusão LGPD, que depende de ON DELETE CASCADE/SET NULL)
-- varre a tabela filha inteira para achar as linhas ligadas, e filtros por org_id/produtor_id
-- ficam em varredura sequencial. As tabelas ainda são pequenas; o custo dos índices é desprezível
-- agora e evita a degradação quando a carteira crescer.

create index if not exists agenda_eventos_consultor_id_idx on agro.agenda_eventos (consultor_id);
create index if not exists agenda_eventos_talhao_id_idx on agro.agenda_eventos (talhao_id);
create index if not exists agenda_eventos_visita_id_idx on agro.agenda_eventos (visita_id);
create index if not exists assinaturas_plano_idx on agro.assinaturas (plano);
create index if not exists cobrancas_assinatura_id_idx on agro.cobrancas (assinatura_id);
create index if not exists compartilhamentos_criado_por_idx on agro.compartilhamentos (criado_por);
create index if not exists compartilhamentos_org_id_idx on agro.compartilhamentos (org_id);
create index if not exists convites_criado_por_idx on agro.convites (criado_por);
create index if not exists convites_org_id_idx on agro.convites (org_id);
create index if not exists convites_equipe_criado_por_idx on agro.convites_equipe (criado_por);
create index if not exists documentos_enviado_por_idx on agro.documentos (enviado_por);
create index if not exists financeiro_centros_custo_propriedade_id_idx on agro.financeiro_centros_custo (propriedade_id);
create index if not exists financeiro_centros_custo_talhao_id_idx on agro.financeiro_centros_custo (talhao_id);
create index if not exists financeiro_escrit_lancamentos_categoria_id_idx on agro.financeiro_escrit_lancamentos (categoria_id);
create index if not exists financeiro_escrit_lancamentos_conta_id_idx on agro.financeiro_escrit_lancamentos (conta_id);
create index if not exists financeiro_escrit_lancamentos_produtor_id_idx on agro.financeiro_escrit_lancamentos (produtor_id);
create index if not exists financeiro_lancamentos_categoria_id_idx on agro.financeiro_lancamentos (categoria_id);
create index if not exists financeiro_lancamentos_centro_custo_id_idx on agro.financeiro_lancamentos (centro_custo_id);
create index if not exists financeiro_lancamentos_conta_id_idx on agro.financeiro_lancamentos (conta_id);
create index if not exists financeiro_lancamentos_propriedade_id_idx on agro.financeiro_lancamentos (propriedade_id);
create index if not exists financeiro_lancamentos_safra_id_idx on agro.financeiro_lancamentos (safra_id);
create index if not exists financeiro_lancamentos_talhao_id_idx on agro.financeiro_lancamentos (talhao_id);
create index if not exists financeiro_orcamentos_categoria_id_idx on agro.financeiro_orcamentos (categoria_id);
create index if not exists financeiro_orcamentos_safra_id_idx on agro.financeiro_orcamentos (safra_id);
create index if not exists notificacoes_org_id_idx on agro.notificacoes (org_id);
create index if not exists producao_registros_org_id_idx on agro.producao_registros (org_id);
create index if not exists recomendacoes_emitida_por_idx on agro.recomendacoes (emitida_por);
create index if not exists visita_fotos_produtor_id_idx on agro.visita_fotos (produtor_id);
create index if not exists visita_ocorrencias_produtor_id_idx on agro.visita_ocorrencias (produtor_id);
create index if not exists visitas_consultor_id_idx on agro.visitas (consultor_id);
