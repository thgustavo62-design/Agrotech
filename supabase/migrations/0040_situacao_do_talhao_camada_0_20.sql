-- 0040 — a situação do talhão vem da camada de 0-20 cm
--
-- AG-004: calagem e adubação são calibradas para a camada 0-20 cm. Uma amostra de 20-40 cm (subsuperfície, usada
-- para decidir gessagem) ou de 0-40 cm (composta, sem metodologia de recomendação) NÃO pode virar "a análise do
-- talhão": antes, se fosse a mais recente, ela definia a situação (em ordem / precisa de correção), as pendências
-- do painel e as recomendações pendentes. Mesma view de 0014, só com o filtro de profundidade.
-- (create or replace view mantém as permissões; nenhuma função nova.)

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
    and a2.profundidade = '0-20'   -- camada de recomendação; 20-40 cm é subsuperfície (gessagem) e 0-40 não tem metodologia
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

-- Só as três camadas que o formulário oferece; "not valid" não reprova linhas antigas, só vale para as novas.
alter table agro.analises drop constraint if exists profundidade_conhecida;
alter table agro.analises add constraint profundidade_conhecida
  check (profundidade in ('0-20', '20-40', '0-40')) not valid;

-- O link público do produtor (/r/<token>) recalcula a recomendação de cada análise: uma amostra de 20-40 cm
-- ou 0-40 cm apareceria com calagem e adubação. Mesma função de 0035 com o filtro de profundidade
-- (create or replace mantém o grant a anon/authenticated).
create or replace function agro.resultados_por_token(p_token uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = agro, public
as $$
declare
  comp agro.compartilhamentos;
  out  jsonb;
begin
  select * into comp
  from agro.compartilhamentos
  where token = p_token
    and ativo
    and (expira_em is null or expira_em > now());

  if not found then
    return null;
  end if;

  update agro.compartilhamentos
     set acessos = acessos + 1, ultimo_acesso = now()
   where id = comp.id;

  select jsonb_build_object(
    'produtor',       (select nome from agro.produtores where id = comp.produtor_id),
    'cultura_filtro', comp.cultura,
    'rotulo',         comp.rotulo,
    -- tabelas calibradas do escritório: o link recalcula com elas, igual ao laudo emitido
    'tabelas',        coalesce((select jsonb_object_agg(tipo, conteudo) from agro.tabelas_referencia where org_id = comp.org_id), '{}'::jsonb),
    'gerado_em',      now(),
    'analises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'data_coleta', a.data_coleta, 'profundidade', a.profundidade,
        'talhao', t.nome, 'cultura', t.cultura, 'area_ha', t.area_ha,
        'prod_esperada', coalesce(a.prod_esperada, t.prod_esperada),
        'argila', a.argila, 'ph', a.ph, 'mo', a.mo, 'p', a.p, 'k', a.k, 'na', a.na,
        'ca', a.ca, 'mg', a.mg, 'al', a.al, 'h_al', a.h_al, 's', a.s,
        'b', a.b, 'zn', a.zn, 'cu', a.cu, 'mn', a.mn, 'fe', a.fe,
        'prnt', a.prnt, 'incorporacao', a.incorporacao
      ) order by t.cultura, a.data_coleta desc)
      from agro.analises a
      join agro.talhoes t     on t.id = a.talhao_id
      join agro.propriedades p on p.id = t.propriedade_id
      where p.produtor_id = comp.produtor_id
        and a.arquivado_em is null
        and a.profundidade = '0-20'   -- o link do produtor só mostra recomendação da camada em que ela é calibrada
        and (comp.cultura is null or t.cultura = comp.cultura)
    ), '[]'::jsonb)
  ) into out;

  return out;
end;
$$;
