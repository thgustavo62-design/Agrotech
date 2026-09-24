-- 0018 — o painel do agrônomo vira central operacional (Fase 2 de PRODUCT_V2.md)
--
-- create or replace mantém a mesma assinatura de agro.painel_consultor() —
-- nenhum consumidor existente (app/(consultor)/app/page.tsx,
-- app/(consultor)/app/pendencias/page.tsx) quebra; eles só passam a receber
-- mais chaves no mesmo jsonb. `pendencias` continua exatamente como era
-- (lista sem limite) para não mudar contrato com quem já a consome.
--
-- Campos novos, todos derivados de tabelas que já existem (nenhuma tabela
-- nova nesta migration): visitas atrasadas/próximas (a partir de
-- visitas.proxima_visita — não há agenda_eventos ainda, ver
-- DATABASE_CHANGES.md), recomendações pendentes vs. emitidas no mês,
-- produtores sem visita recente, talhões sem análise atualizada, e a
-- atividade recente lida de audit_log (que até aqui não tinha consumidor
-- de UI — ver PRODUCT_AUDIT.md §7 item 2).

create or replace function agro.painel_consultor()
returns jsonb
language sql
stable
set search_path = agro, public
as $$
  with ultima_proxima as (
    -- última "próxima visita" anotada por talhão (a mais recente visita que
    -- ainda tem uma data de retorno registrada)
    select distinct on (talhao_id) talhao_id, proxima_visita
    from agro.visitas
    where proxima_visita is not null
    order by talhao_id, data desc
  ),
  atrasadas as (
    select u.talhao_id, t.nome, u.proxima_visita as data
    from ultima_proxima u join agro.talhoes t on t.id = u.talhao_id
    where u.proxima_visita < current_date
  ),
  futuras as (
    select u.talhao_id, t.nome, u.proxima_visita as data
    from ultima_proxima u join agro.talhoes t on t.id = u.talhao_id
    where u.proxima_visita >= current_date
  ),
  pendentes as (
    select a.id as analise_id, a.talhao_id, t.nome, t.cultura, a.data_coleta
    from agro.analises a
    join agro.talhoes t on t.id = a.talhao_id
    where a.arquivado_em is null
      and not exists (
        select 1 from agro.recomendacoes r
        where r.analise_id = a.id and r.arquivada_em is null
      )
  )
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

    'visitas_atrasadas_total', (select count(*)::int from atrasadas),
    'visitas_atrasadas', coalesce((
      select jsonb_agg(jsonb_build_object('talhao_id', talhao_id, 'nome', nome, 'data', data) order by data asc)
      from (select * from atrasadas order by data asc limit 10) x
    ), '[]'::jsonb),

    'proximas_visitas', coalesce((
      select jsonb_agg(jsonb_build_object('talhao_id', talhao_id, 'nome', nome, 'data', data) order by data asc)
      from (select * from futuras order by data asc limit 8) x
    ), '[]'::jsonb),

    'recomendacoes_pendentes_total', (select count(*)::int from pendentes),
    'recomendacoes_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'analise_id', analise_id, 'talhao_id', talhao_id, 'nome', nome, 'cultura', cultura, 'data_coleta', data_coleta
      ) order by data_coleta asc)
      from (select * from pendentes order by data_coleta asc limit 10) x
    ), '[]'::jsonb),
    'recomendacoes_emitidas_mes', (
      select count(*)::int from agro.recomendacoes
      where arquivada_em is null and emitida_em >= date_trunc('month', now())
    ),

    'produtores_sem_visita_recente', coalesce((
      select count(*)::int from agro.produtores p
      where exists (select 1 from agro.talhoes t where t.produtor_id = p.id)
        and not exists (
          select 1 from agro.visitas v
          join agro.talhoes t on t.id = v.talhao_id
          where t.produtor_id = p.id and v.data >= (current_date - interval '60 days')
        )
    ), 0),

    'talhoes_sem_analise_atualizada', coalesce((
      select count(*)::int from agro.talhoes t
      where not exists (
        select 1 from agro.analises a
        where a.talhao_id = t.id and a.arquivado_em is null
          and a.data_coleta >= (current_date - interval '180 days')
      )
    ), 0),

    'atividade_recente', coalesce((
      select jsonb_agg(jsonb_build_object(
        'acao', acao, 'entidade', entidade, 'entidade_id', entidade_id,
        'dados', dados, 'criado_em', criado_em
      ) order by criado_em desc)
      from (select * from agro.audit_log order by criado_em desc limit 10) al
    ), '[]'::jsonb)
  )
$$;
