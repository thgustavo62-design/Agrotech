-- 0046 — AgroTech Academy, fatia 1: biblioteca de conteúdos e indicação ao produtor
--
-- Plano: docs/AGROTECH_2_0_PLANO_DE_EXPANSAO (Academy, itens AC-01/03/04/06/12). Cada escritório é o autor e o curador da
-- própria universidade; o produtor só lê o que foi PUBLICADO e é para ele. Nada aqui toca laudo, análise ou recomendação:
-- indicar uma aula não altera o que o agrônomo emitiu.
--
--   academy_conteudos   o conteúdo (vídeo por link, artigo, material em arquivo) com rascunho → publicado → arquivado
--   academy_publicos    quando a visibilidade é "selecionados": quais produtores veem
--   academy_indicacoes  o agrônomo indica um conteúdo a um produtor (opcionalmente a partir de uma visita/análise) e acompanha
--                       indicada → aberta → concluída; o produtor só marca abertura e conclusão
--
-- Permissões novas (espelho em apps/web/lib/permissoes.ts; o db-test confere as duas pontas):
--   academy.gerenciar   criar, editar, publicar e arquivar conteúdo  → Agronômico (e Proprietário)
--   academy.indicar     indicar conteúdo a produtor                  → Agronômico e Campo (e Proprietário)
-- Quem publica é registrado como revisor: o banco grava revisado_por/revisado_em (o cliente não escolhe).

-- ===========================================================================
-- 1. permissões
-- ===========================================================================
create or replace function agro.pode(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = agro, public
as $$
  select coalesce((
    select 'proprietario' = any(pr.perfis)
           or case p_permissao
                when 'carteira.editar'     then pr.perfis && array['agronomico', 'campo']
                when 'recomendacao.emitir' then pr.perfis && array['agronomico']
                when 'tabelas.editar'      then pr.perfis && array['agronomico']
                when 'dados.exportar'      then pr.perfis && array['agronomico']
                when 'relatorios.ver'      then pr.perfis && array['agronomico', 'financeiro', 'leitura']
                when 'financeiro'          then pr.perfis && array['financeiro']
                when 'academy.gerenciar'   then pr.perfis && array['agronomico']
                when 'academy.indicar'     then pr.perfis && array['agronomico', 'campo']
                else false
              end
    from agro.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('consultor', 'admin')
      and pr.org_id is not null
      and pr.desativado_em is null
      and (not pr.mfa_ativo or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  ), false)
$$;

-- ===========================================================================
-- 2. conteúdos
-- ===========================================================================
create table agro.academy_conteudos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  autor_id      uuid references auth.users(id) on delete set null,
  tipo          text not null check (tipo in ('video', 'artigo', 'material')),
  titulo        text not null check (char_length(btrim(titulo)) between 3 and 160),
  descricao     text check (char_length(descricao) <= 2000),
  cultura       text check (char_length(cultura) <= 60),
  tema          text check (tema in ('solo', 'adubacao', 'calagem', 'pragas', 'doencas', 'irrigacao', 'colheita', 'gestao', 'seguranca', 'outro')),
  nivel         text not null default 'basico' check (nivel in ('basico', 'intermediario', 'avancado')),
  duracao_min   int check (duracao_min between 1 and 600),
  -- vídeo ou link externo: só https (nunca javascript:, data:, http:)
  url           text check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 2000),
  corpo         text check (char_length(corpo) <= 20000),
  -- arquivo no bucket privado "academy": {org_id}/{conteudo_id}/{arquivo}
  arquivo_path  text check (char_length(arquivo_path) <= 400),
  -- autoria/origem: direitos autorais (o AgroTech aponta para a fonte, não copia material de terceiros)
  fonte         text check (char_length(fonte) <= 300),
  status        text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  visibilidade  text not null default 'todos' check (visibilidade in ('todos', 'selecionados')),
  revisado_por  uuid references auth.users(id) on delete set null,
  revisado_em   timestamptz,
  publicado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- só publica o que tem o que mostrar
  constraint conteudo_publicavel check (
    status <> 'publicado'
    or case tipo
         when 'video'  then url is not null
         when 'artigo' then coalesce(btrim(corpo), '') <> ''
         else arquivo_path is not null or url is not null
       end
  )
);
create index academy_conteudos_org_status_idx on agro.academy_conteudos(org_id, status);
create index academy_conteudos_autor_idx on agro.academy_conteudos(autor_id);
create index academy_conteudos_revisor_idx on agro.academy_conteudos(revisado_por);
create trigger academy_conteudos_touch before update on agro.academy_conteudos
  for each row execute function agro.touch_atualizado_em();

-- Regras que o cliente não decide: autoria, escritório, quem revisou/publicou e a pasta do arquivo.
create or replace function agro.academy_conteudos_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_cliente then new.autor_id := auth.uid(); end if;
  else
    if new.org_id is distinct from old.org_id then
      raise exception 'O escritório de um conteúdo não pode ser alterado.' using errcode = '42501';
    end if;
    if v_cliente then new.autor_id := old.autor_id; end if;
  end if;

  if new.arquivo_path is not null and new.arquivo_path not like new.org_id::text || '/%' then
    raise exception 'O arquivo precisa estar na pasta do escritório.' using errcode = '22023';
  end if;

  if new.status = 'publicado' then
    -- publicar = revisar: fica registrado quem e quando (salvar de novo um conteúdo publicado renova a revisão)
    if v_cliente then new.revisado_por := auth.uid(); end if;
    new.revisado_em := now();
    new.publicado_em := coalesce(case when tg_op = 'UPDATE' then old.publicado_em end, now());
  elsif v_cliente and tg_op = 'UPDATE' then
    new.revisado_por := old.revisado_por;
    new.revisado_em := old.revisado_em;
    new.publicado_em := old.publicado_em;
  end if;
  return new;
end $$;
create trigger academy_conteudos_regras before insert or update on agro.academy_conteudos
  for each row execute function agro.academy_conteudos_regras();

-- ===========================================================================
-- 3. públicos (visibilidade "selecionados")
-- ===========================================================================
create table agro.academy_publicos (
  conteudo_id uuid not null references agro.academy_conteudos(id) on delete cascade,
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  org_id      uuid not null references agro.orgs(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (conteudo_id, produtor_id)
);
create index academy_publicos_produtor_idx on agro.academy_publicos(produtor_id);
create index academy_publicos_org_idx on agro.academy_publicos(org_id);

create or replace function agro.academy_publicos_herda() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  select c.org_id into new.org_id from agro.academy_conteudos c where c.id = new.conteudo_id;
  if new.org_id is null then
    raise exception 'Conteúdo não encontrado.' using errcode = '22023';
  end if;
  -- o produtor tem de ser do MESMO escritório (a FK sozinha deixaria apontar para outro)
  if not exists (select 1 from agro.produtores p where p.id = new.produtor_id and p.org_id = new.org_id) then
    raise exception 'Produtor de outro escritório.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger academy_publicos_herda before insert on agro.academy_publicos
  for each row execute function agro.academy_publicos_herda();

-- ===========================================================================
-- 4. indicações
-- ===========================================================================
create table agro.academy_indicacoes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  conteudo_id  uuid not null references agro.academy_conteudos(id) on delete cascade,
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  indicado_por uuid references auth.users(id) on delete set null,
  visita_id    uuid references agro.visitas(id) on delete set null,
  analise_id   uuid references agro.analises(id) on delete set null,
  mensagem     text check (char_length(mensagem) <= 600),
  criado_em    timestamptz not null default now(),
  aberto_em    timestamptz,
  concluido_em timestamptz,
  unique (conteudo_id, produtor_id)
);
create index academy_indicacoes_org_idx on agro.academy_indicacoes(org_id);
create index academy_indicacoes_produtor_idx on agro.academy_indicacoes(produtor_id, concluido_em);
create index academy_indicacoes_indicador_idx on agro.academy_indicacoes(indicado_por);
create index academy_indicacoes_visita_idx on agro.academy_indicacoes(visita_id);
create index academy_indicacoes_analise_idx on agro.academy_indicacoes(analise_id);

create or replace function agro.academy_indicacoes_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org    uuid;
  v_status text;
begin
  select c.org_id, c.status into v_org, v_status from agro.academy_conteudos c where c.id = new.conteudo_id;
  if v_org is null then
    raise exception 'Conteúdo não encontrado.' using errcode = '22023';
  end if;
  if v_status <> 'publicado' then
    raise exception 'Só conteúdo publicado pode ser indicado.' using errcode = '22023';
  end if;
  new.org_id := v_org;
  if not exists (select 1 from agro.produtores p where p.id = new.produtor_id and p.org_id = v_org) then
    raise exception 'Produtor de outro escritório.' using errcode = '42501';
  end if;
  -- o contexto (visita/análise) tem de ser do mesmo produtor
  if new.visita_id is not null and not exists (select 1 from agro.visitas v where v.id = new.visita_id and v.produtor_id = new.produtor_id) then
    raise exception 'A visita não é deste produtor.' using errcode = '22023';
  end if;
  if new.analise_id is not null and not exists (select 1 from agro.analises a where a.id = new.analise_id and a.produtor_id = new.produtor_id) then
    raise exception 'A análise não é deste produtor.' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') then
    new.indicado_por := auth.uid();
    new.aberto_em := null;
    new.concluido_em := null;
  end if;
  return new;
end $$;
create trigger academy_indicacoes_regras before insert on agro.academy_indicacoes
  for each row execute function agro.academy_indicacoes_regras();

-- O produtor só marca que abriu e que concluiu — uma vez, e com a hora do servidor.
create or replace function agro.academy_indicacoes_protege() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.id, new.org_id, new.conteudo_id, new.produtor_id, new.indicado_por, new.visita_id, new.analise_id, new.mensagem, new.criado_em)
     is distinct from
     (old.id, old.org_id, old.conteudo_id, old.produtor_id, old.indicado_por, old.visita_id, old.analise_id, old.mensagem, old.criado_em) then
    raise exception 'Só a abertura e a conclusão podem ser registradas.' using errcode = '42501';
  end if;
  if old.aberto_em is not null then new.aberto_em := old.aberto_em;
  elsif new.aberto_em is not null then new.aberto_em := now();
  end if;
  if old.concluido_em is not null then new.concluido_em := old.concluido_em;
  elsif new.concluido_em is not null then new.concluido_em := now();
  end if;
  if new.concluido_em is not null and new.aberto_em is null then new.aberto_em := new.concluido_em; end if;
  return new;
end $$;
create trigger academy_indicacoes_protege before update on agro.academy_indicacoes
  for each row execute function agro.academy_indicacoes_protege();

-- aviso no portal do produtor (só se ele já tem login)
alter table agro.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table agro.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'nova_recomendacao', 'nova_analise', 'visita_agendada', 'visita_realizada', 'documento_disponivel',
  'atividade_vencendo', 'conta_vencendo', 'conteudo_indicado'
));

create or replace function agro.notificar_conteudo_indicado() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user   uuid;
  v_titulo text;
begin
  select p.user_id into v_user from agro.produtores p where p.id = new.produtor_id;
  select c.titulo into v_titulo from agro.academy_conteudos c where c.id = new.conteudo_id;
  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link)
    values (new.org_id, v_user, 'conteudo_indicado',
            'Seu agrônomo indicou um conteúdo: ' || coalesce(v_titulo, 'novo conteúdo'),
            new.mensagem, '/produtor/universidade/' || new.conteudo_id);
  end if;
  return new;
end $$;
create trigger academy_indicacoes_notifica after insert on agro.academy_indicacoes
  for each row execute function agro.notificar_conteudo_indicado();

-- ===========================================================================
-- 5. RLS
-- ===========================================================================
alter table agro.academy_conteudos enable row level security;
alter table agro.academy_publicos enable row level security;
alter table agro.academy_indicacoes enable row level security;

-- o escritório (tenant) vale para tudo, como nas outras tabelas
create policy tenant_guard on agro.academy_conteudos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy tenant_guard on agro.academy_publicos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy tenant_guard on agro.academy_indicacoes as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));

-- equipe do escritório: lê tudo; escrever exige a permissão (restritiva: vale mesmo chamando a API direto)
create policy conteudos_consultor on agro.academy_conteudos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'))
  with check ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy perfil_insert on agro.academy_conteudos as restrictive for insert to authenticated
  with check ((select agro.pode('academy.gerenciar')));
create policy perfil_update on agro.academy_conteudos as restrictive for update to authenticated
  using ((select agro.pode('academy.gerenciar'))) with check ((select agro.pode('academy.gerenciar')));
create policy perfil_delete on agro.academy_conteudos as restrictive for delete to authenticated
  using ((select agro.pode('academy.gerenciar')));

create policy publicos_consultor on agro.academy_publicos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'))
  with check ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy perfil_insert on agro.academy_publicos as restrictive for insert to authenticated
  with check ((select agro.pode('academy.gerenciar')));
create policy perfil_update on agro.academy_publicos as restrictive for update to authenticated
  using ((select agro.pode('academy.gerenciar'))) with check ((select agro.pode('academy.gerenciar')));
create policy perfil_delete on agro.academy_publicos as restrictive for delete to authenticated
  using ((select agro.pode('academy.gerenciar')));

create policy indicacoes_consultor_le on agro.academy_indicacoes for select to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy indicacoes_consultor_cria on agro.academy_indicacoes for insert to authenticated
  with check ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy indicacoes_consultor_apaga on agro.academy_indicacoes for delete to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy perfil_insert on agro.academy_indicacoes as restrictive for insert to authenticated
  with check ((select agro.pode('academy.indicar')));
create policy perfil_delete on agro.academy_indicacoes as restrictive for delete to authenticated
  using ((select agro.pode('academy.indicar')));

-- produtor: só o que foi PUBLICADO e é para ele (todos, selecionado, ou indicado a ele); nunca escreve conteúdo
create policy conteudos_produtor on agro.academy_conteudos for select to authenticated
  using (
    status = 'publicado'
    and (
      visibilidade = 'todos'
      or exists (select 1 from agro.academy_publicos p
                 where p.conteudo_id = academy_conteudos.id and p.produtor_id = (select agro.jwt_produtor()))
      or exists (select 1 from agro.academy_indicacoes i
                 where i.conteudo_id = academy_conteudos.id and i.produtor_id = (select agro.jwt_produtor()))
    )
  );
create policy publicos_produtor on agro.academy_publicos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy indicacoes_produtor_le on agro.academy_indicacoes for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy indicacoes_produtor_marca on agro.academy_indicacoes for update to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));

-- ===========================================================================
-- 6. arquivos (bucket privado "academy": {org_id}/{conteudo_id}/{arquivo})
-- ===========================================================================
insert into storage.buckets (id, name, public) values ('academy', 'academy', false)
on conflict (id) do nothing;

-- limite e tipos aceitos (colunas do Storage real; o banco de teste local não as tem)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets
               set file_size_limit = 20971520,
                   allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
               where id = 'academy'$q$;
  end if;
end $$;

-- equipe lê a pasta do escritório; o produtor lê só o arquivo de um conteúdo que a RLS dele deixa ver
create policy academy_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or exists (select 1 from agro.academy_conteudos c where c.arquivo_path = storage.objects.name)
  )
);
create policy academy_envio on storage.objects for insert to authenticated
with check (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.sou_consultor()
  and (select agro.pode('academy.gerenciar'))
);
create policy academy_troca on storage.objects for update to authenticated
using (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.sou_consultor()
  and (select agro.pode('academy.gerenciar'))
);
create policy academy_remocao on storage.objects for delete to authenticated
using (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.sou_consultor()
  and (select agro.pode('academy.gerenciar'))
);

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044 (o db-test falha se sobrar função executável por anon)
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
