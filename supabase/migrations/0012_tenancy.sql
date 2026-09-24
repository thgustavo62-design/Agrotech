-- 0012 — tenancy à prova de descuido
-- Substitui as políticas em cadeia (EXISTS + joins, reavaliadas por linha) por
-- comparação coluna = literal, com o tenant vindo do JWT. Ver docs/PRODUTO-VENDAVEL.md §1.
--
--   1. org_id / produtor_id desnormalizados em toda tabela de dados, por trigger
--   2. custom_access_token_hook injeta org_id / user_role / produtor_id no token
--   3. guarda RESTRICTIVE de tenant em cada tabela — nenhuma política futura fura

-- ===========================================================================
-- 1. helpers de claim (JWT primeiro, fallback ao profiles durante o rollout)
-- ===========================================================================
create or replace function agro.jwt_org() returns uuid
language sql stable security definer set search_path = agro, public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'org_id', '')::uuid,
    (select org_id from agro.profiles where id = auth.uid())
  )
$$;

create or replace function agro.jwt_role() returns text
language sql stable security definer set search_path = agro, public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'user_role', ''),
    (select role from agro.profiles where id = auth.uid())
  )
$$;

create or replace function agro.jwt_produtor() returns uuid
language sql stable security definer set search_path = agro, public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'produtor_id', '')::uuid,
    (select id from agro.produtores where user_id = auth.uid())
  )
$$;

-- retrocompatibilidade: as funções antigas passam a delegar
create or replace function agro.meu_org_id() returns uuid language sql stable as $$ select agro.jwt_org() $$;
create or replace function agro.meu_role() returns text language sql stable as $$ select agro.jwt_role() $$;
create or replace function agro.meu_produtor_id() returns uuid language sql stable as $$ select agro.jwt_produtor() $$;
create or replace function agro.sou_consultor() returns boolean language sql stable as $$
  select agro.jwt_role() in ('consultor', 'admin')
$$;

-- ===========================================================================
-- 2. custom_access_token_hook
-- ===========================================================================
create or replace function agro.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event -> 'claims';
  v_org  uuid;
  v_role text;
  v_prod uuid;
begin
  select p.org_id, p.role into v_org, v_role
  from agro.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  select pr.id into v_prod
  from agro.produtores pr
  where pr.user_id = (event ->> 'user_id')::uuid;

  if v_org is not null then claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org::text)); end if;
  if v_role is not null then claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role)); end if;
  if v_prod is not null then claims := jsonb_set(claims, '{produtor_id}', to_jsonb(v_prod::text)); end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema agro to supabase_auth_admin;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on agro.profiles to supabase_auth_admin;
grant select on agro.produtores to supabase_auth_admin;
create policy auth_admin_le_profiles on agro.profiles
  as permissive for select to supabase_auth_admin using (true);
create policy auth_admin_le_produtores on agro.produtores
  as permissive for select to supabase_auth_admin using (true);

-- Habilitar em config.toml:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/agro/custom_access_token_hook"

-- ===========================================================================
-- 3. colunas desnormalizadas + triggers de herança + backfill
-- ===========================================================================

-- propriedades: herda org_id do produtor
alter table agro.propriedades add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
update agro.propriedades pr set org_id = p.org_id
  from agro.produtores p where p.id = pr.produtor_id and pr.org_id is null;

create or replace function agro.herdar_de_produtor() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from agro.produtores where id = new.produtor_id;
  return new;
end $$;
create trigger propriedades_herda before insert on agro.propriedades
  for each row execute function agro.herdar_de_produtor();

-- talhoes: herda org_id e produtor_id da propriedade
alter table agro.talhoes add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.talhoes add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.talhoes t set org_id = pr.org_id, produtor_id = pr.produtor_id
  from agro.propriedades pr where pr.id = t.propriedade_id and t.org_id is null;

create or replace function agro.herdar_de_propriedade() returns trigger
language plpgsql as $$
begin
  select org_id, produtor_id into new.org_id, new.produtor_id
  from agro.propriedades where id = new.propriedade_id;
  return new;
end $$;
create trigger talhoes_herda before insert on agro.talhoes
  for each row execute function agro.herdar_de_propriedade();

-- analises / visitas: herdam de talhoes
alter table agro.analises add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.analises add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.analises a set org_id = t.org_id, produtor_id = t.produtor_id
  from agro.talhoes t where t.id = a.talhao_id and a.org_id is null;

alter table agro.visitas add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.visitas add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.visitas v set org_id = t.org_id, produtor_id = t.produtor_id
  from agro.talhoes t where t.id = v.talhao_id and v.org_id is null;

create or replace function agro.herdar_de_talhao() returns trigger
language plpgsql as $$
begin
  select org_id, produtor_id into new.org_id, new.produtor_id
  from agro.talhoes where id = new.talhao_id;
  return new;
end $$;
create trigger analises_herda before insert on agro.analises
  for each row execute function agro.herdar_de_talhao();
create trigger visitas_herda before insert on agro.visitas
  for each row execute function agro.herdar_de_talhao();

-- recomendacoes: herda da analise
alter table agro.recomendacoes add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.recomendacoes add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.recomendacoes r set org_id = a.org_id, produtor_id = a.produtor_id
  from agro.analises a where a.id = r.analise_id and r.org_id is null;

create or replace function agro.herdar_de_analise() returns trigger
language plpgsql as $$
begin
  select org_id, produtor_id into new.org_id, new.produtor_id
  from agro.analises where id = new.analise_id;
  return new;
end $$;
create trigger recomendacoes_herda before insert on agro.recomendacoes
  for each row execute function agro.herdar_de_analise();

-- visita_ocorrencias / visita_fotos: herdam da visita
alter table agro.visita_ocorrencias add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.visita_ocorrencias add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.visita_ocorrencias o set org_id = v.org_id, produtor_id = v.produtor_id
  from agro.visitas v where v.id = o.visita_id and o.org_id is null;

alter table agro.visita_fotos add column if not exists org_id uuid references agro.orgs(id) on delete cascade;
alter table agro.visita_fotos add column if not exists produtor_id uuid references agro.produtores(id) on delete cascade;
update agro.visita_fotos ft set org_id = v.org_id, produtor_id = v.produtor_id
  from agro.visitas v where v.id = ft.visita_id and ft.org_id is null;

create or replace function agro.herdar_de_visita() returns trigger
language plpgsql as $$
begin
  select org_id, produtor_id into new.org_id, new.produtor_id
  from agro.visitas where id = new.visita_id;
  return new;
end $$;
create trigger visita_ocorrencias_herda before insert on agro.visita_ocorrencias
  for each row execute function agro.herdar_de_visita();
create trigger visita_fotos_herda before insert on agro.visita_fotos
  for each row execute function agro.herdar_de_visita();

-- documentos: produtor_id opcional (lote pode não ter produtor definido ainda)
alter table agro.documentos add column if not exists produtor_id uuid references agro.produtores(id) on delete set null;

-- ===========================================================================
-- 4. índices nas colunas de política
-- ===========================================================================
create index if not exists propriedades_org_idx  on agro.propriedades(org_id);
create index if not exists talhoes_org_idx        on agro.talhoes(org_id);
create index if not exists talhoes_prod_idx       on agro.talhoes(produtor_id);
create index if not exists analises_org_idx        on agro.analises(org_id);
create index if not exists analises_prod_idx       on agro.analises(produtor_id);
create index if not exists recomendacoes_org_idx   on agro.recomendacoes(org_id);
create index if not exists recomendacoes_prod_idx  on agro.recomendacoes(produtor_id);
create index if not exists visitas_org_idx         on agro.visitas(org_id);
create index if not exists visitas_prod_idx        on agro.visitas(produtor_id);
create index if not exists visita_ocorrencias_org_idx on agro.visita_ocorrencias(org_id);
create index if not exists visita_fotos_org_idx    on agro.visita_fotos(org_id);
create index if not exists documentos_prod_idx     on agro.documentos(produtor_id);

-- ===========================================================================
-- 5. políticas: derruba as em cadeia, cria coluna = literal + guarda restritiva
-- ===========================================================================
-- (os `drop function` de talhao_na_minha_org/talhao_do_meu_produtor ficam lá
-- embaixo, depois de derrubar toda policy que ainda os referencia — na
-- ordem original ficavam aqui em cima e o Postgres recusava com "cannot
-- drop function... because other objects depend on it" [2BP01]; só apareceu
-- ao rodar contra Postgres de verdade pela 1ª vez, 2026-09-23)

-- macro conceitual (escrita à mão por tabela abaixo):
--   RESTRICTIVE tenant_guard:  org_id = (select agro.jwt_org())
--   PERMISSIVE  <t>_consultor: (select agro.jwt_role()) in ('consultor','admin')
--   PERMISSIVE  <t>_produtor:  produtor_id = (select agro.jwt_produtor())   [select]

-- ---- produtores ----------------------------------------------------------
drop policy if exists produtores_consultor on agro.produtores;
drop policy if exists produtores_dono on agro.produtores;
create policy tenant_guard on agro.produtores as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy produtores_consultor on agro.produtores for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy produtores_dono on agro.produtores for select to authenticated
  using (user_id = (select auth.uid()));

-- ---- propriedades ------------------------------------------------------
drop policy if exists propriedades_consultor on agro.propriedades;
drop policy if exists propriedades_produtor on agro.propriedades;
create policy tenant_guard on agro.propriedades as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy propriedades_consultor on agro.propriedades for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy propriedades_produtor on agro.propriedades for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

-- ---- talhoes ---------------------------------------------------------
drop policy if exists talhoes_consultor on agro.talhoes;
drop policy if exists talhoes_produtor on agro.talhoes;
create policy tenant_guard on agro.talhoes as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy talhoes_consultor on agro.talhoes for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy talhoes_produtor on agro.talhoes for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

-- ---- analises ------------------------------------------------------
drop policy if exists analises_consultor on agro.analises;
drop policy if exists analises_produtor on agro.analises;
create policy tenant_guard on agro.analises as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy analises_consultor on agro.analises for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy analises_produtor on agro.analises for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()) and arquivado_em is null);

-- ---- recomendacoes -------------------------------------------------
drop policy if exists recomendacoes_consultor on agro.recomendacoes;
drop policy if exists recomendacoes_produtor on agro.recomendacoes;
create policy tenant_guard on agro.recomendacoes as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy recomendacoes_consultor on agro.recomendacoes for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy recomendacoes_produtor on agro.recomendacoes for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()) and arquivada_em is null);

-- ---- visitas -----------------------------------------------------
drop policy if exists visitas_consultor on agro.visitas;
drop policy if exists visitas_produtor on agro.visitas;
create policy tenant_guard on agro.visitas as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy visitas_consultor on agro.visitas for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy visitas_produtor on agro.visitas for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

-- ---- visita_ocorrencias / visita_fotos --------------------------
drop policy if exists visita_ocorrencias_acesso on agro.visita_ocorrencias;
create policy tenant_guard on agro.visita_ocorrencias as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy visita_ocorrencias_consultor on agro.visita_ocorrencias for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy visita_ocorrencias_produtor on agro.visita_ocorrencias for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

drop policy if exists visita_fotos_acesso on agro.visita_fotos;
create policy tenant_guard on agro.visita_fotos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy visita_fotos_consultor on agro.visita_fotos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy visita_fotos_produtor on agro.visita_fotos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

-- nenhuma policy acima depende mais das funções antigas — agora sim dá pra derrubá-las
drop function if exists agro.talhao_na_minha_org(uuid);
drop function if exists agro.talhao_do_meu_produtor(uuid);

-- ---- documentos (só consultor) ---------------------------------
drop policy if exists documentos_consultor on agro.documentos;
create policy tenant_guard on agro.documentos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy documentos_consultor on agro.documentos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));

-- ---- tabelas_referencia / compartilhamentos / convites -------
drop policy if exists tabelas_referencia_consultor on agro.tabelas_referencia;
create policy tenant_guard on agro.tabelas_referencia as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy tabelas_referencia_consultor on agro.tabelas_referencia for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));

drop policy if exists compartilhamentos_consultor on agro.compartilhamentos;
create policy tenant_guard on agro.compartilhamentos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy compartilhamentos_consultor on agro.compartilhamentos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));

drop policy if exists convites_consultor on agro.convites;
create policy tenant_guard on agro.convites as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy convites_consultor on agro.convites for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));

-- ---- audit_log (leitura do consultor) ------------------------
drop policy if exists audit_log_consultor on agro.audit_log;
create policy audit_log_consultor on agro.audit_log for select to authenticated
  using (org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin'));

-- orgs / profiles: mantêm as políticas permissivas de 0007 (id = ..., já rápidas)
