-- 0027 — histórico diário de métricas (pré-requisito pra tendência real no painel)
-- Sem cron: a function abaixo faz upsert da linha de hoje toda vez que o
-- painel (/app) carrega — barato, idempotente (unique org_id+data). O card
-- de métrica só mostra "+X% vs mês anterior" quando existir uma snapshot de
-- ~30 dias atrás de verdade; sem histórico suficiente, não mostra nada —
-- nunca inventa número (decisão do Gustavo, 2026-09-24).

create table agro.metricas_diarias (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references agro.orgs(id) on delete cascade,
  data                        date not null,
  produtores                  int not null default 0,
  talhoes                     int not null default 0,
  area_total                  numeric(12,2) not null default 0,
  analises                    int not null default 0,
  laudos_emitidos_mes         int not null default 0,
  recomendacoes_emitidas_mes  int not null default 0,
  criado_em                   timestamptz not null default now(),
  unique (org_id, data)
);
create index metricas_diarias_org_data_idx on agro.metricas_diarias(org_id, data desc);

alter table agro.metricas_diarias enable row level security;
create policy metricas_diarias_consultor on agro.metricas_diarias for select to authenticated
  using (org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin'));
-- sem policy de insert/update pra client direto — só via function abaixo (security definer)

create or replace function agro.registrar_metricas_hoje() returns void
language plpgsql security definer set search_path = agro, public as $$
declare
  v_org        uuid := (select agro.jwt_org());
  v_produtores int;
  v_talhoes    int;
  v_area       numeric;
  v_analises   int;
  v_laudos     int;
  v_recs       int;
begin
  if v_org is null or (select agro.jwt_role()) not in ('consultor', 'admin') then
    return;
  end if;

  select count(*) into v_produtores from agro.produtores where org_id = v_org;
  select count(*), coalesce(sum(area_ha), 0) into v_talhoes, v_area from agro.talhoes where org_id = v_org;
  select count(*) into v_analises from agro.analises where org_id = v_org and arquivado_em is null;
  select count(*) into v_laudos from agro.documentos
    where org_id = v_org and status = 'confirmado' and criado_em >= date_trunc('month', now());
  select count(*) into v_recs from agro.recomendacoes
    where org_id = v_org and arquivada_em is null and emitida_em >= date_trunc('month', now());

  insert into agro.metricas_diarias
    (org_id, data, produtores, talhoes, area_total, analises, laudos_emitidos_mes, recomendacoes_emitidas_mes)
  values
    (v_org, current_date, v_produtores, v_talhoes, v_area, v_analises, v_laudos, v_recs)
  on conflict (org_id, data) do update set
    produtores = excluded.produtores,
    talhoes = excluded.talhoes,
    area_total = excluded.area_total,
    analises = excluded.analises,
    laudos_emitidos_mes = excluded.laudos_emitidos_mes,
    recomendacoes_emitidas_mes = excluded.recomendacoes_emitidas_mes;
end $$;
grant execute on function agro.registrar_metricas_hoje() to authenticated;
