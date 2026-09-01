-- 0001 — schema agro, extensões, organizações e perfis
-- Regra de ouro do projeto: nenhuma tabela sem RLS (ver 0007). O service_role
-- só é usado dentro de Edge Functions, nunca no browser.

create schema if not exists agro;

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- organizações (escritórios de assistência técnica)
-- ---------------------------------------------------------------------------
create table agro.orgs (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cnpj       text,
  municipio  text,
  uf         text default 'ES',
  plano      text not null default 'free',
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- perfis — 1:1 com auth.users, criado por trigger
-- ---------------------------------------------------------------------------
create table agro.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references agro.orgs(id) on delete set null,
  role       text not null default 'consultor'
             check (role in ('admin', 'consultor', 'produtor')),
  nome       text,
  crea       text,
  art        text,               -- nº da ART, quando houver (doc §14)
  fone       text,
  criado_em  timestamptz not null default now()
);
create index profiles_org_idx on agro.profiles(org_id);

-- trigger: nasce um usuário em auth.users -> nasce o profile
create or replace function agro.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
begin
  insert into agro.profiles (id, role, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'consultor'),
    new.raw_user_meta_data ->> 'nome'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function agro.handle_new_user();

-- updated_at genérico, reutilizado pelas próximas migrações
create or replace function agro.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
