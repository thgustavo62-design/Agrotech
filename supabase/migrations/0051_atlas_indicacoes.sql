-- 0051 — Atlas: indicar uma ficha a um produtor
--
-- O agrônomo (ou o técnico de campo) indica uma ficha do Atlas a um produtor, opcionalmente a partir de uma visita ou análise,
-- e acompanha se o produtor abriu. Vale para as fichas-base (que moram no código: guarda-se o "slug") e para as fichas do
-- escritório (guarda-se o id; só ficha PUBLICADA do mesmo escritório pode ser indicada).
-- Permissão: academy.indicar (a mesma das indicações de conteúdo). O aviso ao produtor reaproveita o tipo 'conteudo_indicado'.

create table agro.atlas_indicacoes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  ficha_id     uuid references agro.atlas_fichas(id) on delete cascade,
  ficha_slug   text check (ficha_slug ~ '^[a-z0-9-]{3,60}$'),
  titulo       text not null check (char_length(btrim(titulo)) between 3 and 160),
  indicado_por uuid references auth.users(id) on delete set null,
  visita_id    uuid references agro.visitas(id) on delete set null,
  analise_id   uuid references agro.analises(id) on delete set null,
  mensagem     text check (char_length(mensagem) <= 600),
  criado_em    timestamptz not null default now(),
  aberto_em    timestamptz,
  constraint uma_ficha check ((ficha_id is not null)::int + (ficha_slug is not null)::int = 1)
);
create unique index atlas_indicacoes_unica_ficha_idx on agro.atlas_indicacoes(produtor_id, ficha_id) where ficha_id is not null;
create unique index atlas_indicacoes_unica_slug_idx on agro.atlas_indicacoes(produtor_id, ficha_slug) where ficha_slug is not null;
create index atlas_indicacoes_org_idx on agro.atlas_indicacoes(org_id);
create index atlas_indicacoes_ficha_idx on agro.atlas_indicacoes(ficha_id);
create index atlas_indicacoes_indicador_idx on agro.atlas_indicacoes(indicado_por);
create index atlas_indicacoes_visita_idx on agro.atlas_indicacoes(visita_id);
create index atlas_indicacoes_analise_idx on agro.atlas_indicacoes(analise_id);

-- O banco decide: escritório (vem do produtor), ficha publicada do mesmo escritório, contexto do mesmo produtor, quem indicou.
create or replace function agro.atlas_indicacoes_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org_produtor uuid;
  v_org_ficha    uuid;
  v_status       text;
  v_nome         text;
begin
  select p.org_id into v_org_produtor from agro.produtores p where p.id = new.produtor_id;
  if v_org_produtor is null then raise exception 'Produtor não encontrado.' using errcode = '22023'; end if;
  new.org_id := v_org_produtor;

  if new.ficha_id is not null then
    select f.org_id, f.status, f.nome into v_org_ficha, v_status, v_nome from agro.atlas_fichas f where f.id = new.ficha_id;
    if v_org_ficha is null then raise exception 'Ficha não encontrada.' using errcode = '22023'; end if;
    if v_org_ficha <> v_org_produtor then raise exception 'Ficha de outro escritório.' using errcode = '42501'; end if;
    if v_status <> 'publicado' then raise exception 'Só ficha publicada pode ser indicada.' using errcode = '22023'; end if;
    new.titulo := v_nome;
  end if;

  if new.visita_id is not null and not exists (select 1 from agro.visitas v where v.id = new.visita_id and v.produtor_id = new.produtor_id) then
    raise exception 'A visita não é deste produtor.' using errcode = '22023';
  end if;
  if new.analise_id is not null and not exists (select 1 from agro.analises a where a.id = new.analise_id and a.produtor_id = new.produtor_id) then
    raise exception 'A análise não é deste produtor.' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') then
    new.indicado_por := auth.uid();
    new.aberto_em := null;
  end if;
  return new;
end $$;
create trigger atlas_indicacoes_regras before insert on agro.atlas_indicacoes
  for each row execute function agro.atlas_indicacoes_regras();

-- O produtor só marca que abriu — uma vez, com a hora do servidor.
create or replace function agro.atlas_indicacoes_protege() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if (new.id, new.org_id, new.produtor_id, new.ficha_id, new.ficha_slug, new.titulo, new.indicado_por, new.visita_id, new.analise_id, new.mensagem, new.criado_em)
     is distinct from
     (old.id, old.org_id, old.produtor_id, old.ficha_id, old.ficha_slug, old.titulo, old.indicado_por, old.visita_id, old.analise_id, old.mensagem, old.criado_em) then
    raise exception 'Só a abertura pode ser registrada.' using errcode = '42501';
  end if;
  if old.aberto_em is not null then new.aberto_em := old.aberto_em;
  elsif new.aberto_em is not null then new.aberto_em := now();
  end if;
  return new;
end $$;
create trigger atlas_indicacoes_protege before update on agro.atlas_indicacoes
  for each row execute function agro.atlas_indicacoes_protege();

-- aviso no portal do produtor (só se ele já tem login)
create or replace function agro.notificar_ficha_indicada() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user uuid;
begin
  select p.user_id into v_user from agro.produtores p where p.id = new.produtor_id;
  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link)
    values (new.org_id, v_user, 'conteudo_indicado',
            'Seu agrônomo indicou uma ficha do Atlas: ' || new.titulo,
            new.mensagem, '/academy/atlas/' || coalesce(new.ficha_id::text, new.ficha_slug));
  end if;
  return new;
end $$;
create trigger atlas_indicacoes_notifica after insert on agro.atlas_indicacoes
  for each row execute function agro.notificar_ficha_indicada();

-- RLS
alter table agro.atlas_indicacoes enable row level security;
create policy tenant_guard on agro.atlas_indicacoes as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy indicacoes_atlas_equipe_le on agro.atlas_indicacoes for select to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy indicacoes_atlas_equipe_cria on agro.atlas_indicacoes for insert to authenticated
  with check ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy indicacoes_atlas_equipe_apaga on agro.atlas_indicacoes for delete to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy perfil_insert on agro.atlas_indicacoes as restrictive for insert to authenticated
  with check ((select agro.pode('academy.indicar')));
create policy perfil_delete on agro.atlas_indicacoes as restrictive for delete to authenticated
  using ((select agro.pode('academy.indicar')));
create policy indicacoes_atlas_produtor_le on agro.atlas_indicacoes for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy indicacoes_atlas_produtor_marca on agro.atlas_indicacoes for update to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- ajudantes internos: só por gatilho
revoke execute on function agro.academy_sincronizar_curso(uuid, uuid) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_equipe(uuid, uuid, text, text, text, text) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_produtor(uuid, uuid, text, text, text, text) from authenticated, service_role;
