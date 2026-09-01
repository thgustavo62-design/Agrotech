-- 0010 — link público de resultados por produtor / cultura
-- O consultor gera um link; o produtor abre sem login e vê os resultados da
-- lavoura (ou de uma cultura) em tempo real. Acesso somente leitura, escopado
-- ao token, via função security definer (a RLS das tabelas continua fechada).

create table agro.compartilhamentos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  produtor_id   uuid not null references agro.produtores(id) on delete cascade,
  cultura       text,                         -- null = todas as culturas do produtor
  rotulo        text,
  token         uuid not null default gen_random_uuid(),
  ativo         boolean not null default true,
  expira_em     timestamptz,
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz,
  acessos       int not null default 0
);
create unique index compartilhamentos_token_idx on agro.compartilhamentos(token);
create index compartilhamentos_produtor_idx on agro.compartilhamentos(produtor_id);

alter table agro.compartilhamentos enable row level security;

create policy compartilhamentos_consultor on agro.compartilhamentos
for all to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check (org_id = agro.meu_org_id() and agro.sou_consultor());

-- ---------------------------------------------------------------------------
-- payload público: chamado pelo role anon com o token do link
-- ---------------------------------------------------------------------------
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

grant usage on schema agro to anon;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
