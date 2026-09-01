-- 0007 — RLS em TODAS as tabelas do schema agro
-- Barreira real do isolamento entre organizações e entre produtores.
-- Falha aqui = vazamento de carteira. Testado no CI (supabase/tests/rls.test.sql).

-- helpers de cadeia (talhão -> propriedade -> produtor -> org)
create or replace function agro.talhao_na_minha_org(p_talhao uuid)
returns boolean language sql stable security definer
set search_path = agro, public as $$
  select exists (
    select 1
    from agro.talhoes t
    join agro.propriedades pr on pr.id = t.propriedade_id
    join agro.produtores p on p.id = pr.produtor_id
    where t.id = p_talhao and p.org_id = agro.meu_org_id()
  )
$$;

create or replace function agro.talhao_do_meu_produtor(p_talhao uuid)
returns boolean language sql stable security definer
set search_path = agro, public as $$
  select exists (
    select 1
    from agro.talhoes t
    join agro.propriedades pr on pr.id = t.propriedade_id
    where t.id = p_talhao and pr.produtor_id = agro.meu_produtor_id()
  )
$$;

-- =========================================================================
alter table agro.orgs enable row level security;

create policy orgs_consultor on agro.orgs
for select to authenticated
using (id = agro.meu_org_id());

-- =========================================================================
alter table agro.profiles enable row level security;

create policy profiles_proprio on agro.profiles
for select to authenticated
using (id = auth.uid());

create policy profiles_org on agro.profiles
for select to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor());

create policy profiles_atualiza_proprio on agro.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- =========================================================================
alter table agro.produtores enable row level security;

create policy produtores_consultor on agro.produtores
for all to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check (org_id = agro.meu_org_id() and agro.sou_consultor());

create policy produtores_dono on agro.produtores
for select to authenticated
using (user_id = auth.uid());

-- =========================================================================
alter table agro.propriedades enable row level security;

create policy propriedades_consultor on agro.propriedades
for all to authenticated
using (exists (
  select 1 from agro.produtores p
  where p.id = propriedades.produtor_id
    and p.org_id = agro.meu_org_id() and agro.sou_consultor()))
with check (exists (
  select 1 from agro.produtores p
  where p.id = propriedades.produtor_id
    and p.org_id = agro.meu_org_id() and agro.sou_consultor()));

create policy propriedades_produtor on agro.propriedades
for select to authenticated
using (produtor_id = agro.meu_produtor_id());

-- =========================================================================
alter table agro.talhoes enable row level security;

create policy talhoes_consultor on agro.talhoes
for all to authenticated
using (agro.talhao_na_minha_org(id) and agro.sou_consultor())
with check (agro.talhao_na_minha_org(id) and agro.sou_consultor());

create policy talhoes_produtor on agro.talhoes
for select to authenticated
using (agro.talhao_do_meu_produtor(id));

-- =========================================================================
alter table agro.documentos enable row level security;

create policy documentos_consultor on agro.documentos
for all to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check (org_id = agro.meu_org_id() and agro.sou_consultor());

-- =========================================================================
alter table agro.analises enable row level security;

create policy analises_consultor on agro.analises
for all to authenticated
using (agro.talhao_na_minha_org(talhao_id) and agro.sou_consultor())
with check (agro.talhao_na_minha_org(talhao_id) and agro.sou_consultor());

create policy analises_produtor on agro.analises
for select to authenticated
using (agro.talhao_do_meu_produtor(talhao_id) and arquivado_em is null);

-- =========================================================================
alter table agro.recomendacoes enable row level security;

create policy recomendacoes_consultor on agro.recomendacoes
for all to authenticated
using (exists (
  select 1 from agro.analises a
  where a.id = recomendacoes.analise_id
    and agro.talhao_na_minha_org(a.talhao_id) and agro.sou_consultor()))
with check (exists (
  select 1 from agro.analises a
  where a.id = recomendacoes.analise_id
    and agro.talhao_na_minha_org(a.talhao_id) and agro.sou_consultor()));

create policy recomendacoes_produtor on agro.recomendacoes
for select to authenticated
using (exists (
  select 1 from agro.analises a
  where a.id = recomendacoes.analise_id
    and agro.talhao_do_meu_produtor(a.talhao_id))
  and arquivada_em is null);

-- =========================================================================
alter table agro.visitas enable row level security;

create policy visitas_consultor on agro.visitas
for all to authenticated
using (agro.talhao_na_minha_org(talhao_id) and agro.sou_consultor())
with check (agro.talhao_na_minha_org(talhao_id) and agro.sou_consultor());

create policy visitas_produtor on agro.visitas
for select to authenticated
using (agro.talhao_do_meu_produtor(talhao_id));

-- =========================================================================
alter table agro.visita_ocorrencias enable row level security;

create policy visita_ocorrencias_acesso on agro.visita_ocorrencias
for all to authenticated
using (exists (
  select 1 from agro.visitas v
  where v.id = visita_ocorrencias.visita_id
    and (
      (agro.talhao_na_minha_org(v.talhao_id) and agro.sou_consultor())
      or agro.talhao_do_meu_produtor(v.talhao_id)
    )))
with check (exists (
  select 1 from agro.visitas v
  where v.id = visita_ocorrencias.visita_id
    and agro.talhao_na_minha_org(v.talhao_id) and agro.sou_consultor()));

-- =========================================================================
alter table agro.visita_fotos enable row level security;

create policy visita_fotos_acesso on agro.visita_fotos
for all to authenticated
using (exists (
  select 1 from agro.visitas v
  where v.id = visita_fotos.visita_id
    and (
      (agro.talhao_na_minha_org(v.talhao_id) and agro.sou_consultor())
      or agro.talhao_do_meu_produtor(v.talhao_id)
    )))
with check (exists (
  select 1 from agro.visitas v
  where v.id = visita_fotos.visita_id
    and agro.talhao_na_minha_org(v.talhao_id) and agro.sou_consultor()));

-- =========================================================================
alter table agro.tabelas_referencia enable row level security;

create policy tabelas_referencia_consultor on agro.tabelas_referencia
for all to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check (org_id = agro.meu_org_id() and agro.sou_consultor());

-- =========================================================================
alter table agro.convites enable row level security;

create policy convites_consultor on agro.convites
for all to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check (org_id = agro.meu_org_id() and agro.sou_consultor());

-- =========================================================================
alter table agro.audit_log enable row level security;

create policy audit_log_consultor on agro.audit_log
for select to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor());
-- inserção só via service_role (Edge Functions), que ignora RLS.
