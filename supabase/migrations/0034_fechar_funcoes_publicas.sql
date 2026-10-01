-- 0034 — fecha as funções privilegiadas do schema agro
--
-- Achado de auditoria: no Postgres toda função nasce executável por PUBLIC, e o schema
-- agro é exposto pelo PostgREST. Com a chave anônima (que fica no navegador) qualquer
-- pessoa SEM LOGIN conseguia chamar /rest/v1/rpc/... e:
--   * casar_produtor(org, nome)      -> listar nomes de produtores de QUALQUER escritório
--     (também por consultor de outro escritório: sem checagem de org);
--   * semear_categorias_financeiras* -> gravar categorias em QUALQUER produtor/escritório.
-- (registrar_metricas_hoje já se protege; tenho_feature/checar_limite só leem o próprio plano.)
--
-- Correção em duas camadas:
--   1. ninguém executa por padrão; abre-se só o que o app precisa, por papel;
--   2. as três funções passam a conferir quem chama, mesmo para quem tem EXECUTE.

-- 1) padrão fechado, hoje e para funções futuras ---------------------------------------
revoke execute on all functions in schema agro from public, anon;
alter default privileges in schema agro revoke execute on functions from public, anon;

-- públicas de propósito: a pessoa ainda não tem login (convite) ou acessa um link com token
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;

-- as políticas de RLS chamam estas funções com o privilégio de quem consulta
grant execute on all functions in schema agro to authenticated, service_role;
-- o hook de login é só do Auth (0012 já tirava de authenticated; o grant acima reabriu)
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- 2) conferência de quem chama ----------------------------------------------------------
create or replace function agro.casar_produtor(p_org uuid, p_nome text)
returns table (id uuid, nome text, score real)
language sql
stable
security definer
set search_path = agro, public
as $$
  select p.id,
         p.nome,
         similarity(agro.normalizar_nome(p.nome), agro.normalizar_nome(p_nome)) as score
  from agro.produtores p
  where p.org_id = p_org
    -- só o consultor/admin do PRÓPRIO escritório enxerga a carteira dele
    and p_org = (select agro.jwt_org())
    and (select agro.jwt_role()) in ('consultor', 'admin')
    and agro.normalizar_nome(p.nome) % agro.normalizar_nome(p_nome)
  order by score desc
  limit 5
$$;

create or replace function agro.semear_categorias_financeiras(p_produtor uuid)
returns void language plpgsql security definer set search_path = agro, public as $$
begin
  if p_produtor is distinct from (select agro.jwt_produtor()) then
    raise exception 'sem permissão para este produtor' using errcode = '42501';
  end if;
  if exists (select 1 from agro.financeiro_categorias where produtor_id = p_produtor) then
    return;
  end if;
  insert into agro.financeiro_categorias (produtor_id, nome, tipo, padrao)
  select p_produtor, nome, tipo, true from (values
    ('Venda de produção','receita'), ('Outras receitas','receita'),
    ('Adubo','despesa'), ('Fertilizantes','despesa'), ('Defensivos','despesa'),
    ('Calcário','despesa'), ('Mão de obra','despesa'), ('Combustível','despesa'),
    ('Energia','despesa'), ('Irrigação','despesa'), ('Máquinas','despesa'),
    ('Manutenção','despesa'), ('Transporte','despesa'), ('Colheita','despesa'),
    ('Beneficiamento','despesa'), ('Outros','despesa')
  ) as padrao(nome, tipo);
end $$;

create or replace function agro.semear_categorias_financeiras_escritorio(p_org uuid)
returns void language plpgsql security definer set search_path = agro, public as $$
begin
  if p_org is distinct from (select agro.jwt_org())
     or (select agro.jwt_role()) not in ('consultor', 'admin') then
    raise exception 'sem permissão para este escritório' using errcode = '42501';
  end if;
  if exists (select 1 from agro.financeiro_escrit_categorias where org_id = p_org) then
    return;
  end if;
  insert into agro.financeiro_escrit_categorias (org_id, nome, tipo, padrao)
  select p_org, nome, tipo, true from (values
    ('Consultoria técnica','receita'), ('Laudos e análises','receita'), ('Outras receitas','receita'),
    ('Combustível','despesa'), ('Equipamentos','despesa'), ('Software e assinaturas','despesa'),
    ('Salários','despesa'), ('Aluguel','despesa'), ('Material de escritório','despesa'),
    ('Marketing','despesa'), ('Contabilidade','despesa'), ('Outros','despesa')
  ) as padrao(nome, tipo);
end $$;
