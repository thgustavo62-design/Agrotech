-- 0044 — identidade da equipe (AG-013)
--
-- 1. profiles.senha_provisoria: o proprietário cria o empregado com uma senha que ELE conhece. Enquanto a pessoa
--    não trocar a própria senha, o app só mostra a tela de troca. A marca sai sozinha quando a senha muda
--    (gatilho em auth.users) — ninguém "se libera" pelo cliente, que também não consegue editar a marca.
-- 2. profiles.mfa_ativo: espelho de "esta pessoa tem verificação em duas etapas confirmada" (gatilho em
--    auth.mfa_factors). O app exige o segundo fator só de quem ligou — opcional por pessoa, recomendado ao proprietário.
-- 3. limite de usuários do plano no BANCO: contar vagas no app deixava duas criações simultâneas passarem do
--    usuarios_max. Agora o gatilho serializa por escritório e recusa.
--
-- As funções novas são de gatilho: nada a executar pelo cliente. A varredura final (como em 0037) mantém anon sem
-- acesso a elas.

alter table agro.profiles add column if not exists senha_provisoria boolean not null default false;
alter table agro.profiles add column if not exists mfa_ativo boolean not null default false;

-- 1+2) o cliente não mexe nestas marcas (nem em desativado_em): só o servidor e os gatilhos
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
  if new.senha_provisoria is distinct from old.senha_provisoria or new.mfa_ativo is distinct from old.mfa_ativo then
    raise exception 'Esta marca da conta é controlada pelo servidor.' using errcode = '42501';
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

-- a marca de senha provisória sai quando a senha de verdade muda (qualquer caminho: tela, link, API)
create or replace function agro.limpar_senha_provisoria()
returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update agro.profiles set senha_provisoria = false where id = new.id and senha_provisoria;
  end if;
  return null;
end;
$$;

drop trigger if exists limpa_senha_provisoria on auth.users;
create trigger limpa_senha_provisoria after update of encrypted_password on auth.users
  for each row execute function agro.limpar_senha_provisoria();

-- 2) espelho do segundo fator (a tabela é do Auth do Supabase)
create or replace function agro.espelhar_mfa()
returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update agro.profiles
     set mfa_ativo = exists (select 1 from auth.mfa_factors f where f.user_id = v_user and f.status = 'verified')
   where id = v_user;
  return null;
end;
$$;

-- auth.mfa_factors pertence ao Auth do Supabase: se este papel não puder criar gatilho nela, a migração NÃO cai — o app
-- sincroniza o espelho pela ação sincronizarMfa (config/acoes.ts) toda vez que a pessoa liga ou desliga o fator.
do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    drop trigger if exists espelha_mfa on auth.mfa_factors;
    create trigger espelha_mfa after insert or update or delete on auth.mfa_factors
      for each row execute function agro.espelhar_mfa();
  end if;
exception when insufficient_privilege then
  raise warning 'sem permissão para criar o gatilho em auth.mfa_factors; o espelho de MFA depende da ação sincronizarMfa do app';
end $$;

-- quem já tinha fator confirmado antes desta migration
do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    update agro.profiles p set mfa_ativo = true
     where exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified');
  end if;
end $$;

-- 3) limite de usuários do plano, atômico
create or replace function agro.checar_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
declare
  v_max int;
  v_atual int;
begin
  if new.org_id is null or new.role not in ('consultor', 'admin') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.org_id is not distinct from old.org_id then
    return new;   -- não está entrando num escritório
  end if;

  -- uma entrada de cada vez por escritório (duas criações simultâneas não passam juntas do limite)
  perform pg_advisory_xact_lock(hashtext('usuarios:' || new.org_id::text));

  select pl.usuarios_max into v_max
    from agro.assinaturas a join agro.planos pl on pl.id = a.plano
   where a.org_id = new.org_id;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_atual
    from agro.profiles
   where org_id = new.org_id and role in ('consultor', 'admin') and id <> new.id and desativado_em is null;
  if v_atual >= v_max then
    raise exception 'O plano do escritório atingiu o limite de % usuário(s).', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_limite_usuarios on agro.profiles;
create trigger profiles_limite_usuarios before insert or update of org_id on agro.profiles
  for each row execute function agro.checar_limite_usuarios();

-- 2b) o segundo fator vale no BANCO, não só na tela. Quem ligou a verificação em duas etapas só enxerga e grava dados com
--     uma sessão de nível aal2 (senha + código). Com sessão aal1 (só a senha) o escritório some, como numa conta
--     desativada: quem tem a senha mas não o celular não lê nada nem pela API. O próprio perfil continua legível —
--     é por ele que o app descobre que falta digitar o código. Todas as políticas passam por jwt_org/jwt_role/pode.
create or replace function agro.jwt_org() returns uuid
language sql stable security definer set search_path = agro, public as $$
  select case
    when p.id is null then nullif(auth.jwt() ->> 'org_id', '')::uuid
    when p.desativado_em is not null then null
    when p.mfa_ativo and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
    else p.org_id
  end
  from (select 1) base
  left join agro.profiles p on p.id = auth.uid()
$$;

create or replace function agro.jwt_role() returns text
language sql stable security definer set search_path = agro, public as $$
  select case
    when p.id is null then nullif(auth.jwt() ->> 'user_role', '')
    when p.desativado_em is not null then null
    when p.mfa_ativo and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
    else p.role
  end
  from (select 1) base
  left join agro.profiles p on p.id = auth.uid()
$$;

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
      and (not pr.mfa_ativo or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  ), false)
$$;

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037 (db-test falha se sobrar função executável por anon)
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
