-- 0035 — o link público de resultados usa as tabelas calibradas do escritório
-- A página /r/[token] recalculava a recomendação com a tabela PADRÃO da literatura, ignorando
-- a calibração do escritório (doses, faixas, fósforo): o produtor via números diferentes do
-- laudo emitido. A função agora devolve também as tabelas da org dona do link (create or
-- replace mantém o grant a anon/authenticated).

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
        and (comp.cultura is null or t.cultura = comp.cultura)
    ), '[]'::jsonb)
  ) into out;

  return out;
end;
$$;
