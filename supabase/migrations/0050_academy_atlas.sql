-- 0050 — Academy: Atlas de doenças e pragas do ESCRITÓRIO (fichas próprias, com fotos)
--
-- As fichas-base (Embrapa) moram no código (apps/web/lib/atlas-base.ts). Aqui entram as fichas que o próprio agrônomo escreve,
-- a partir do manual técnico dele: o texto é do escritório (a fonte e o link são opcionais, para quando se apoia em outra obra).
--
--   atlas_fichas   a ficha (rascunho → publicado → arquivado); o produtor só lê o que está PUBLICADO
--   atlas_fotos    até 8 fotos por ficha, no bucket privado "academy" ({org}/atlas/{ficha}/{arquivo})
--
-- Quem escreve: academy.gerenciar (Agronômico e Proprietário), a mesma permissão do Estúdio. O banco grava autor e revisor;
-- publicar exige texto sobre a ficha, ao menos uma parte da planta e ao menos uma foto.

-- ---------------------------------------------------------------------------
-- 1. ajudante: itens de uma lista de texto (nada vazio, nenhum grande demais)
-- ---------------------------------------------------------------------------
create or replace function agro.itens_de_texto_ok(p_itens text[], p_max int) returns boolean
language sql immutable parallel safe set search_path = agro, public as $$
  select coalesce(cardinality(p_itens), 0) <= 12
         and not exists (select 1 from unnest(coalesce(p_itens, '{}'::text[])) x where btrim(x) = '' or char_length(x) > p_max)
$$;

-- ---------------------------------------------------------------------------
-- 2. fichas
-- ---------------------------------------------------------------------------
create table agro.atlas_fichas (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references agro.orgs(id) on delete cascade,
  autor_id            uuid references auth.users(id) on delete set null,
  tipo                text not null check (tipo in ('doenca', 'praga', 'outro')),
  nome                text not null check (char_length(btrim(nome)) between 3 and 120),
  cientifico          text check (char_length(cientifico) <= 160),
  outros_nomes        text check (char_length(outros_nomes) <= 200),
  cultura             text check (char_length(cultura) <= 60),
  partes              text[] not null default '{}'
                      check (partes <@ array['folha', 'fruto', 'flor', 'ramo', 'ponteiro', 'raiz', 'colo', 'caule', 'muda']::text[]),
  importancia_campo   text check (importancia_campo in ('extrema', 'alta', 'media', 'baixa', 'nula')),
  importancia_viveiro text check (importancia_viveiro in ('extrema', 'alta', 'media', 'baixa', 'nula')),
  sobre               text[] not null default '{}' check (agro.itens_de_texto_ok(sobre, 1500)),
  favorecem           text[] not null default '{}' check (agro.itens_de_texto_ok(favorecem, 600)),
  manejo              text[] not null default '{}' check (agro.itens_de_texto_ok(manejo, 900)),
  monitoramento       text[] not null default '{}' check (agro.itens_de_texto_ok(monitoramento, 900)),
  confunde            text check (char_length(confunde) <= 500),
  -- autoria/origem (direitos autorais): opcional; o link, quando houver, é só https
  fonte               text check (char_length(fonte) <= 300),
  url                 text check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 2000),
  status              text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  revisado_por        uuid references auth.users(id) on delete set null,
  revisado_em         timestamptz,
  publicado_em        timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint ficha_publicavel check (status <> 'publicado' or (cardinality(sobre) > 0 and cardinality(partes) > 0))
);
create index atlas_fichas_org_status_idx on agro.atlas_fichas(org_id, status);
create index atlas_fichas_autor_idx on agro.atlas_fichas(autor_id);
create index atlas_fichas_revisor_idx on agro.atlas_fichas(revisado_por);
create trigger atlas_fichas_touch before update on agro.atlas_fichas
  for each row execute function agro.touch_atualizado_em();

-- Regras que o cliente não decide: autoria, escritório, quem revisou/publicou e a exigência de foto.
create or replace function agro.atlas_fichas_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_cliente then new.autor_id := auth.uid(); end if;
  else
    if new.org_id is distinct from old.org_id then
      raise exception 'O escritório de uma ficha não pode ser alterado.' using errcode = '42501';
    end if;
    if v_cliente then new.autor_id := old.autor_id; end if;
  end if;

  if new.status = 'publicado' then
    if tg_op = 'INSERT' or not exists (select 1 from agro.atlas_fotos f where f.ficha_id = new.id) then
      raise exception 'Adicione pelo menos uma foto antes de publicar a ficha.' using errcode = '22023';
    end if;
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
create trigger atlas_fichas_regras before insert or update on agro.atlas_fichas
  for each row execute function agro.atlas_fichas_regras();

-- ---------------------------------------------------------------------------
-- 3. fotos
-- ---------------------------------------------------------------------------
create table agro.atlas_fotos (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  ficha_id     uuid not null references agro.atlas_fichas(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 400),
  legenda      text check (char_length(legenda) <= 200),
  posicao      int not null default 0 check (posicao between 0 and 50),
  criado_em    timestamptz not null default now(),
  unique (storage_path)
);
create index atlas_fotos_ficha_idx on agro.atlas_fotos(ficha_id, posicao);
create index atlas_fotos_org_idx on agro.atlas_fotos(org_id);

create or replace function agro.atlas_fotos_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org uuid;
begin
  select f.org_id into v_org from agro.atlas_fichas f where f.id = new.ficha_id;
  if v_org is null then raise exception 'Ficha não encontrada.' using errcode = '22023'; end if;
  new.org_id := v_org;
  if new.storage_path not like v_org::text || '/atlas/' || new.ficha_id::text || '/%' then
    raise exception 'A foto precisa estar na pasta desta ficha.' using errcode = '22023';
  end if;
  if (select count(*) from agro.atlas_fotos x where x.ficha_id = new.ficha_id) >= 8 then
    raise exception 'Esta ficha já tem 8 fotos (o máximo).' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger atlas_fotos_regras before insert on agro.atlas_fotos
  for each row execute function agro.atlas_fotos_regras();

-- uma ficha publicada não fica sem foto (apagar a ficha inteira continua valendo)
create or replace function agro.atlas_fotos_protege() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_status text;
begin
  select f.status into v_status from agro.atlas_fichas f where f.id = old.ficha_id;
  if v_status = 'publicado' and (select count(*) from agro.atlas_fotos x where x.ficha_id = old.ficha_id) <= 1 then
    raise exception 'Uma ficha publicada precisa de pelo menos uma foto. Volte a ficha a rascunho antes de apagar a última.' using errcode = '22023';
  end if;
  return old;
end $$;
create trigger atlas_fotos_protege before delete on agro.atlas_fotos
  for each row execute function agro.atlas_fotos_protege();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table agro.atlas_fichas enable row level security;
alter table agro.atlas_fotos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['atlas_fichas', 'atlas_fotos'] loop
    execute format('create policy tenant_guard on agro.%I as restrictive for all to authenticated using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()))', t);
    -- equipe lê tudo do escritório e escreve (a permissão restritiva abaixo é quem decide quem escreve)
    execute format('create policy %I on agro.%I for all to authenticated using ((select agro.jwt_role()) in (''consultor'', ''admin'')) with check ((select agro.jwt_role()) in (''consultor'', ''admin''))', t || '_equipe', t);
    execute format('create policy perfil_insert on agro.%I as restrictive for insert to authenticated with check ((select agro.pode(''academy.gerenciar'')))', t);
    execute format('create policy perfil_update on agro.%I as restrictive for update to authenticated using ((select agro.pode(''academy.gerenciar''))) with check ((select agro.pode(''academy.gerenciar'')))', t);
    execute format('create policy perfil_delete on agro.%I as restrictive for delete to authenticated using ((select agro.pode(''academy.gerenciar'')))', t);
  end loop;
end $$;

-- produtor: só ficha PUBLICADA do próprio escritório (e as fotos dela); nunca escreve
create policy fichas_produtor on agro.atlas_fichas for select to authenticated
  using ((select agro.jwt_role()) = 'produtor' and status = 'publicado');
create policy fotos_produtor on agro.atlas_fotos for select to authenticated
  using ((select agro.jwt_role()) = 'produtor'
         and exists (select 1 from agro.atlas_fichas f where f.id = atlas_fotos.ficha_id and f.status = 'publicado'));

-- ---------------------------------------------------------------------------
-- 5. arquivos: o produtor lê só a foto de uma ficha que a RLS dele deixa ver
--    (a equipe já lê a pasta do escritório pela política academy_leitura; envio/troca/remoção também já exigem academy.gerenciar)
-- ---------------------------------------------------------------------------
create policy atlas_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (storage.foldername(name))[2] = 'atlas'
  and exists (select 1 from agro.atlas_fotos p where p.storage_path = storage.objects.name)
);

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
