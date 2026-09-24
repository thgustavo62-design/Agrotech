-- 0025 — Fase 11: feature flags por plano e papéis novos
-- Igual à proposta em docs/DATABASE_CHANGES.md §0025, com uma diferença
-- deliberada nos valores semeados (ver nota abaixo) e uma function nova que
-- a proposta original não previa: agro.tenho_feature().

alter table agro.planos add column if not exists features jsonb not null default '{}'::jsonb;
alter table agro.planos add column if not exists usuarios_max int not null default 1;

comment on column agro.planos.features is
  'feature flags do plano, ex.: {"financeiro": true, "relatorios_avancados": false}';

-- Nota de divergência (2026-09-24): a proposta original diferenciava os
-- planos já nesta migration (teste sem financeiro/relatórios, técnico e
-- escritório com). Decisão: todo plano nasce com os dois flags **true** —
-- a organização já em uso hoje está ativamente testando financeiro e
-- relatórios, e decidir o que vira premium é decisão comercial de quem
-- vende o software, não algo pra travar sozinho numa migration. A
-- infraestrutura de gating (agro.tenho_feature(), abaixo) já está real e
-- testada nas duas telas que ela protege — só não está restringindo nada
-- ainda. Mudar isso no futuro é um único `update agro.planos set features
-- = ...`, sem tocar em código.
update agro.planos set features = '{"financeiro": true, "relatorios_avancados": true}'::jsonb
  where id = 'teste';
update agro.planos set features = '{"financeiro": true, "relatorios_avancados": true}'::jsonb, usuarios_max = 3
  where id = 'tecnico';
update agro.planos set features = '{"financeiro": true, "relatorios_avancados": true}'::jsonb, usuarios_max = 10
  where id = 'escritorio';

-- papéis novos no mesmo check existente (PRODUCT_V2.md §2.3 — aditivo, sem
-- migrar para enum; nome do constraint confirmado contra o banco real)
alter table agro.profiles drop constraint if exists profiles_role_check;
alter table agro.profiles add constraint profiles_role_check
  check (role in ('admin','consultor','produtor','proprietario','tecnico','assistente'));

alter table agro.profiles add column if not exists titulo text;  -- rótulo livre, cosmético (PRODUCT_V2.md §2.3)

-- Leitura de feature flag por qualquer papel (consultor OU produtor), sem
-- expor a tabela agro.assinaturas inteira (valores/gateway) pra quem não é
-- consultor — mesmo padrão de exposição controlada já usado no projeto
-- (painel_consultor, producao_visivel_consultor, resultados_por_token).
create or replace function agro.tenho_feature(p_chave text) returns boolean
language sql stable security definer set search_path = agro, public as $$
  select coalesce(
    (select (pl.features->>p_chave)::boolean
     from agro.assinaturas a join agro.planos pl on pl.id = a.plano
     where a.org_id = (select agro.jwt_org())),
    false
  )
$$;
grant execute on function agro.tenho_feature(text) to authenticated;
