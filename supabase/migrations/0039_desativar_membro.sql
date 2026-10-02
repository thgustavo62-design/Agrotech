-- 0039 — remover alguém da equipe de verdade: a conta é desativada, não só desvinculada
--
-- Antes: "Remover do escritório" zerava profiles.org_id e a conta de login continuava existindo; ao entrar de
-- novo a pessoa ganhava um escritório de teste vazio (garantirEscritorio). Agora o app (service role) bane a
-- conta no Auth, libera o e-mail e marca o perfil com `desativado_em`. Esta migration dá ao banco o que
-- precisa para isso valer MESMO com um token antigo ainda não expirado (o token carrega o org_id por até 1 h):
--   1. profiles.desativado_em;
--   2. agro.pode() — usada em toda política restritiva de ESCRITA — exige perfil ativo e ainda num escritório,
--      então quem foi removido deixa de poder gravar na hora (a leitura segue o token até ele expirar, ≤ 1 h);
--   3. gatilho: o cliente (PostgREST) não mexe em desativado_em — só o servidor;
--   4. criar_escritorio() recusa conta desativada (não abre escritório de teste).
-- Nenhuma função nova: nada a revogar de anon.

alter table agro.profiles add column if not exists desativado_em timestamptz;

-- 2) permissões: só perfil ativo e dentro de um escritório
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
    where pr.id = auth.uid()
      and pr.role in ('consultor', 'admin')
      and pr.org_id is not null
      and pr.desativado_em is null
  ), false)
$$;

-- 3) o cliente não (des)ativa contas: só o servidor
create or replace function agro.proteger_perfil()
returns trigger
language plpgsql
set search_path = agro, public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O identificador do perfil não pode ser alterado.' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'O papel de acesso não pode ser alterado por aqui.' using errcode = '42501';
  end if;
  if new.desativado_em is distinct from old.desativado_em then
    raise exception 'A desativação de contas é feita pelo servidor.' using errcode = '42501';
  end if;

  if old.id is distinct from auth.uid() then
    if old.org_id is distinct from (select agro.meu_org_id()) or not (select agro.pode('equipe.gerenciar')) then
      raise exception 'Somente o proprietário gerencia a equipe.' using errcode = '42501';
    end if;
  end if;

  if new.org_id is distinct from old.org_id and new.org_id is not null then
    raise exception 'A troca de escritório só acontece por convite.' using errcode = '42501';
  end if;

  if new.perfis is distinct from old.perfis and not (select agro.pode('equipe.gerenciar')) then
    raise exception 'Somente o proprietário altera perfis de acesso.' using errcode = '42501';
  end if;

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

-- 4) conta desativada não abre escritório
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
  v_off timestamptz;
  v_org uuid;
begin
  if v_user is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;
  select role, org_id, desativado_em into v_role, v_atual, v_off from agro.profiles where id = v_user;
  if v_role is null or v_role not in ('consultor', 'admin') then
    raise exception 'Somente consultor cria escritório.' using errcode = '42501';
  end if;
  if v_off is not null then
    raise exception 'Esta conta foi desativada.' using errcode = '42501';
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
