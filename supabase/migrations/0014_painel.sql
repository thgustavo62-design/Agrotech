-- 0014 — painel agregado no banco (uma chamada, RLS preservada)
-- Ver docs/PRODUTO-VENDAVEL.md §3.

-- Situação de cada talhão pela análise mais recente. É um INDICADOR grosseiro
-- para a fila de trabalho — o número autoritativo (com a tabela calibrada da
-- organização) sai do motor agro-core na tela de interpretação.
create or replace view agro.vw_talhao_situacao
with (security_invoker = on) as
select
  t.id            as talhao_id,
  t.org_id,
  t.produtor_id,
  t.nome,
  t.cultura,
  t.area_ha,
  a.id            as analise_id,
  a.data_coleta,
  a.ph,
  round((100 * s.sb / nullif(s.tcap, 0))::numeric, 1)        as v,
  round((100 * coalesce(a.al, 0) / nullif(s.t, 0))::numeric, 1) as m,
  case
    when a.id is null then 'sem_analise'
    when (100 * s.sb / nullif(s.tcap, 0)) < 45
      or (100 * coalesce(a.al, 0) / nullif(s.t, 0)) > 20 then 'precisa_correcao'
    else 'em_ordem'
  end as situacao
from agro.talhoes t
left join lateral (
  select a2.*
  from agro.analises a2
  where a2.talhao_id = t.id and a2.arquivado_em is null
  order by a2.data_coleta desc
  limit 1
) a on true
left join lateral (
  select
    (coalesce(a.ca, 0) + coalesce(a.mg, 0) + coalesce(a.k, 0) / 391.0 + coalesce(a.na, 0) / 230.0) as sb
) sb0 on true
left join lateral (
  select
    sb0.sb                       as sb,
    sb0.sb + coalesce(a.al, 0)   as t,
    sb0.sb + coalesce(a.h_al, 0) as tcap
) s on true;

-- Painel do consultor: um JSON, uma chamada. SECURITY INVOKER -> a RLS vale.
create or replace function agro.painel_consultor()
returns jsonb
language sql
stable
set search_path = agro, public
as $$
  select jsonb_build_object(
    'produtores', (select count(*) from agro.produtores),
    'talhoes',    (select count(*) from agro.talhoes),
    'area_total', (select coalesce(sum(area_ha), 0) from agro.talhoes),
    'analises',   (select count(*) from agro.analises where arquivado_em is null),
    'laudos_fila',(select count(*) from agro.documentos where status = 'revisao'),
    'pendencias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'talhao_id', talhao_id, 'analise_id', analise_id, 'nome', nome,
        'cultura', cultura, 'data_coleta', data_coleta, 'v', v, 'm', m
      ) order by v nulls first)
      from agro.vw_talhao_situacao
      where situacao = 'precisa_correcao'
    ), '[]'::jsonb),
    'area_por_cultura', coalesce((
      select jsonb_object_agg(cultura, area)
      from (select cultura, sum(area_ha) as area from agro.talhoes group by cultura) x
    ), '{}'::jsonb),
    'ultimas_visitas', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'data', data, 'fenologia', fenologia) order by data desc)
      from (select id, data, fenologia from agro.visitas order by data desc limit 5) v
    ), '[]'::jsonb)
  )
$$;

grant execute on function agro.painel_consultor() to authenticated;
