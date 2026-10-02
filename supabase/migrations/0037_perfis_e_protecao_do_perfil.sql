-- 0037 — perfis de acesso da equipe e proteção do próprio perfil
--
-- FALHA CRÍTICA CORRIGIDA (achada ao desenhar as permissões da equipe):
--   profiles_atualiza_proprio (0007) só conferia `id = auth.uid()`, sem limitar colunas.
--   Qualquer usuário logado — inclusive um PRODUTOR — podia, pela API REST, fazer
--       update agro.profiles set role = 'consultor', org_id = '<qualquer escritório>'
--   e virar consultor de outro escritório (ou promover-se no próprio). Reproduzido no
--   packages/db-test antes da correção. Além disso, handle_new_user (0001) gravava
--   `role` direto dos metadados do cadastro, controlados pelo cliente (role=admin).
--
-- O que muda:
--   1. profiles.perfis (text[]): o que cada pessoa pode fazer (proprietario, agronomico,
--      campo, financeiro, leitura). Combináveis, como no Aegro. Quem já era consultor vira proprietario
--      (nada muda para quem já usa).
--   2. agro.pode(permissao): a regra perfil -> permissão, uma só fonte no banco.
--   3. Gatilho agro.proteger_perfil: o cliente não altera role nem troca de escritório; só
--      quem gerencia a equipe altera perfis/remove; nunca sai o último proprietário.
--      Funções SECURITY DEFINER e service_role passam (current_user não é authenticated).
--   4. agro.criar_escritorio(): cria o escritório e promove quem criou, no servidor — o
--      app deixa de atualizar profiles.org_id pelo cliente.
--   5. handle_new_user só aceita role consultor|produtor vindo do cadastro.
--   6. convite de equipe carrega os perfis; aceitar respeita usuarios_max do plano.

-- 1) perfis ---------------------------------------------------------------------------
alter table agro.profiles add column if not exists perfis text[] not null default '{}';
alter table agro.profiles drop constraint if exists profiles_perfis_check;
alter table agro.profiles add constraint profiles_perfis_check
  check (perfis <@ array['proprietario','agronomico','campo','financeiro','leitura']::text[]);

-- quem já era da equipe mantém o acesso total de hoje
update agro.profiles set perfis = array['proprietario'] where role in ('consultor','admin') and perfis = '{}';

alter table agro.convites_equipe add column if not exists perfis text[] not null default array['leitura']::text[];
alter table agro.convites_equipe drop constraint if exists convites_equipe_perfis_check;
alter table agro.convites_equipe add constraint convites_equipe_perfis_check
  check (perfis <@ array['proprietario','agronomico','campo','financeiro','leitura']::text[] and cardinality(perfis) > 0);

-- 2) a regra de permissões -------------------------------------------------------------
-- proprietario pode tudo. Os demais, só o que o perfil descreve (espelhado em
-- apps/web/lib/permissoes.ts; db-test confere que os dois concordam).
create or replace function agro.pode(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = agro, public
as $$
  select coalesce((
    select 'proprietario' = any(pr.perfis)
           or case p_permissao
                when 'carteira.editar'     then pr.perfis && array['agronomico', 'campo']
                when 'recomendacao.emitir' then pr.perfis && array['agronomico']
                when 'tabelas.editar'      then pr.perfis && array['agronomico']
                when 'dados.exportar'      then pr.perfis && array['agronomico']
                when 'relatorios.ver'      then pr.perfis && array['agronomico', 'financeiro', 'leitura']
                when 'financeiro'          then pr.perfis && array['financeiro']
                else false
              end
    from agro.profiles pr
    where pr.id = auth.uid() and pr.role in ('consultor', 'admin')
  ), false)
$$;

-- 3) o perfil não é um formulário aberto ------------------------------------------------
create or replace function agro.proteger_perfil()
returns trigger
language plpgsql
set search_path = agro, public
as $$
begin
  -- só vigia o cliente (PostgREST). Funções SECURITY DEFINER (aceitar convite, criar escritório)
  -- rodam como o dono e passam; service_role também.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O identificador do perfil não pode ser alterado.' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'O papel de acesso não pode ser alterado por aqui.' using errcode = '42501';
  end if;

  -- mexer no cadastro de OUTRA pessoa é gerenciar equipe
  if old.id is distinct from auth.uid() then
    if old.org_id is distinct from (select agro.meu_org_id()) or not (select agro.pode('equipe.gerenciar')) then
      raise exception 'Somente o proprietário gerencia a equipe.' using errcode = '42501';
    end if;
  end if;

  -- escritório: só pode SAIR (null). Entrar em outro é só por convite (função do servidor).
  if new.org_id is distinct from old.org_id and new.org_id is not null then
    raise exception 'A troca de escritório só acontece por convite.' using errcode = '42501';
  end if;

  if new.perfis is distinct from old.perfis and not (select agro.pode('equipe.gerenciar')) then
    raise exception 'Somente o proprietário altera perfis de acesso.' using errcode = '42501';
  end if;

  -- nunca sobra um escritório sem proprietário
  if old.org_id is not null
     and 'proprietario' = any(old.perfis)
     and (not ('proprietario' = any(new.perfis)) or new.org_id is null)
     and not exists (
       select 1 from agro.profiles p
       where p.org_id = old.org_id and p.id <> old.id and p.role in ('consultor', 'admin') and 'proprietario' = any(p.perfis)
     ) then
    raise exception 'O escritório precisa de pelo menos um proprietário.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protege on agro.profiles;
create trigger profiles_protege before update on agro.profiles
  for each row execute function agro.proteger_perfil();

-- 'equipe.gerenciar', 'plano.gerenciar', 'escritorio.editar' e 'dados.excluir' só o proprietário tem
-- (caem no `else false` de agro.pode, que o proprietário supera).

-- 4) criar o escritório no servidor -----------------------------------------------------
create or replace function agro.criar_escritorio(p_nome text, p_municipio text default null, p_uf text default 'ES')
returns uuid
language plpgsql
volatile
security definer
set search_path = agro, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_atual uuid;
  v_org uuid;
begin
  if v_user is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;
  select role, org_id into v_role, v_atual from agro.profiles where id = v_user;
  if v_role is null or v_role not in ('consultor', 'admin') then
    raise exception 'Somente consultor cria escritório.' using errcode = '42501';
  end if;
  if v_atual is not null then
    return v_atual; -- idempotente
  end if;

  insert into agro.orgs (nome, municipio, uf)
  values (coalesce(nullif(trim(p_nome), ''), 'Meu escritório'), nullif(trim(p_municipio), ''), upper(left(coalesce(nullif(trim(p_uf), ''), 'ES'), 2)))
  returning id into v_org;

  update agro.profiles set org_id = v_org, perfis = array['proprietario'] where id = v_user;
  return v_org;
end;
$$;
grant execute on function agro.criar_escritorio(text, text, text) to authenticated;

-- o cliente não cria mais org direto
drop policy if exists orgs_criar on agro.orgs;

-- 5) cadastro: o cliente não escolhe papel privilegiado ----------------------------------
create or replace function agro.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
declare
  v_role text := case when new.raw_user_meta_data ->> 'role' = 'produtor' then 'produtor' else 'consultor' end;
begin
  insert into agro.profiles (id, role, nome, perfis)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data ->> 'nome',
    case when v_role = 'consultor' then array['proprietario'] else '{}'::text[] end
  );
  return new;
end;
$$;

-- 6) convite de equipe: perfis do convite + limite de usuários do plano -------------------
create or replace function agro.aceitar_convite_equipe(p_token uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = agro, public
as $$
declare
  cv        agro.convites_equipe;
  v_user    uuid := auth.uid();
  v_membros int;
  v_maximo  int;
begin
  if v_user is null then
    raise exception 'sem sessão' using errcode = 'insufficient_privilege';
  end if;

  select * into cv
  from agro.convites_equipe
  where token = p_token and usado_em is null and expira_em > now();

  if not found then
    return null;                       -- token inválido, usado ou expirado
  end if;

  select pl.usuarios_max into v_maximo
  from agro.assinaturas a join agro.planos pl on pl.id = a.plano
  where a.org_id = cv.org_id;
  select count(*) into v_membros from agro.profiles where org_id = cv.org_id and role in ('consultor', 'admin');
  if v_maximo is not null and v_membros >= v_maximo then
    raise exception 'O plano do escritório atingiu o limite de % usuário(s).', v_maximo;
  end if;

  update agro.profiles
     set org_id = cv.org_id, role = 'consultor', titulo = cv.titulo, perfis = cv.perfis
   where id = v_user;

  update agro.convites_equipe set usado_em = now() where id = cv.id;
  return cv.org_id;
end;
$$;

create or replace function agro.convite_equipe_resumo(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = agro, public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'valido', (c.usado_em is null and c.expira_em > now()),
    'organizacao', (select nome from agro.orgs where id = c.org_id),
    'titulo', c.titulo,
    'perfis', c.perfis,
    'email', c.email
  ) end
  from (select * from agro.convites_equipe where token = p_token) c
$$;

-- 7) funções novas nascem executáveis por PUBLIC no Postgres -------------------------------
-- (o `alter default privileges ... in schema` de 0034 não remove o EXECUTE padrão de PUBLIC).
-- Toda migration que cria função repete esta varredura; o db-test (seguranca.test.ts) falha se
-- sobrar função executável por anon além das três públicas por token.
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
