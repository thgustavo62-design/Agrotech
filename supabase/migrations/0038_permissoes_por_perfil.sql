-- 0038 — permissões por perfil aplicadas no banco (RLS restritiva)
--
-- Até aqui todo "consultor" fazia tudo. Com os perfis de 0037, cada tabela sensível passa a
-- exigir a permissão certa — por política RESTRITIVA (soma-se às permissivas já existentes, nunca
-- as enfraquece), então um bug de tela não vira acesso indevido: a regra vale mesmo chamando a API
-- direto. Mapa perfil -> permissão: agro.pode() em 0037 / apps/web/lib/permissoes.ts.
--
--   carteira.editar      produtores, propriedades, talhões, análises, laudos, visitas, agenda, links
--   recomendacao.emitir  recomendações
--   tabelas.editar       tabelas de referência
--   financeiro           financeiro do escritório (leitura e escrita) + comprovantes
--   equipe.gerenciar     convites e perfis da equipe
--   escritorio.editar    dados do escritório
--   dados.excluir        exclusão de produtor (LGPD)

do $$
declare
  t   text;
  cmd text;
begin
  -- carteira técnica: escrever exige carteira.editar (leitura segue livre para a equipe)
  foreach t in array array[
    'produtores', 'propriedades', 'talhoes', 'analises', 'documentos', 'visitas',
    'visita_ocorrencias', 'visita_fotos', 'agenda_eventos', 'compartilhamentos', 'convites'
  ] loop
    execute format('create policy perfil_insert on agro.%I as restrictive for insert to authenticated with check ((select agro.pode(%L)))', t, 'carteira.editar');
    execute format('create policy perfil_update on agro.%I as restrictive for update to authenticated using ((select agro.pode(%L))) with check ((select agro.pode(%L)))', t, 'carteira.editar', 'carteira.editar');
    execute format('create policy perfil_delete on agro.%I as restrictive for delete to authenticated using ((select agro.pode(%L)))', t, 'carteira.editar');
  end loop;

  -- recomendações e tabelas de referência: escrita por permissão própria
  foreach cmd in array array['insert', 'update', 'delete'] loop
    if cmd = 'insert' then
      execute format('create policy perfil_%s on agro.recomendacoes as restrictive for insert to authenticated with check ((select agro.pode(%L)))', cmd, 'recomendacao.emitir');
      execute format('create policy perfil_%s on agro.tabelas_referencia as restrictive for insert to authenticated with check ((select agro.pode(%L)))', cmd, 'tabelas.editar');
    elsif cmd = 'update' then
      execute format('create policy perfil_%s on agro.recomendacoes as restrictive for update to authenticated using ((select agro.pode(%L))) with check ((select agro.pode(%L)))', cmd, 'recomendacao.emitir', 'recomendacao.emitir');
      execute format('create policy perfil_%s on agro.tabelas_referencia as restrictive for update to authenticated using ((select agro.pode(%L))) with check ((select agro.pode(%L)))', cmd, 'tabelas.editar', 'tabelas.editar');
    else
      execute format('create policy perfil_%s on agro.recomendacoes as restrictive for delete to authenticated using ((select agro.pode(%L)))', cmd, 'recomendacao.emitir');
      execute format('create policy perfil_%s on agro.tabelas_referencia as restrictive for delete to authenticated using ((select agro.pode(%L)))', cmd, 'tabelas.editar');
    end if;
  end loop;

  -- financeiro do escritório: quem não é do financeiro nem lê
  foreach t in array array['financeiro_escrit_categorias', 'financeiro_escrit_contas', 'financeiro_escrit_lancamentos'] loop
    execute format('create policy perfil_financeiro on agro.%I as restrictive for all to authenticated using ((select agro.pode(%L))) with check ((select agro.pode(%L)))', t, 'financeiro', 'financeiro');
  end loop;
end $$;

-- equipe: convites só com equipe.gerenciar (profiles tem o gatilho de 0037)
create policy perfil_equipe on agro.convites_equipe as restrictive for all to authenticated
  using ((select agro.pode('equipe.gerenciar'))) with check ((select agro.pode('equipe.gerenciar')));

-- dados do escritório
create policy perfil_escritorio on agro.orgs as restrictive for update to authenticated
  using ((select agro.pode('escritorio.editar'))) with check ((select agro.pode('escritorio.editar')));

-- exclusão de produtor (pedido LGPD) é do proprietário
create policy perfil_excluir on agro.produtores as restrictive for delete to authenticated
  using ((select agro.pode('dados.excluir')));

-- arquivos: comprovantes do financeiro do escritório e uploads da carteira seguem as mesmas permissões
create policy perfil_storage_financeiro on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'financeiro-escritorio' or (select agro.pode('financeiro')))
  with check (bucket_id <> 'financeiro-escritorio' or (select agro.pode('financeiro')));

create policy perfil_storage_carteira_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('laudos', 'visitas', 'recomendacoes') or (select agro.pode('carteira.editar')));
create policy perfil_storage_carteira_update on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('laudos', 'visitas', 'recomendacoes') or (select agro.pode('carteira.editar')));
create policy perfil_storage_carteira_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id not in ('laudos', 'visitas', 'recomendacoes') or (select agro.pode('carteira.editar')));
