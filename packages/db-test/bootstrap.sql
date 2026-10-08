-- stubs do que o Supabase fornece
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- fatores de MFA do Auth (só as colunas que o AgroTech lê)
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, factor_type text default 'totp', status text not null default 'unverified');
-- igual ao Supabase: aceita o claim legado (request.jwt.claim.sub) ou o JSON (request.jwt.claims)
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
