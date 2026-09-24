-- 0002 — carteira: produtores, propriedades, talhões
-- Hierarquia: org -> produtor -> propriedade -> talhão. Tudo cascateia para baixo.

-- unaccent() vem da extensão (0001) declarada STABLE, não IMMUTABLE —
-- Postgres recusa usá-la direto numa coluna gerada ("generation expression
-- is not immutable", SQLSTATE 42P17; só apareceu ao rodar contra Postgres de
-- verdade pela 1ª vez, 2026-09-23). Envelope IMMUTABLE de propósito — nome
-- próprio de cadastro não depende de config de sessão na prática; é o
-- contorno documentado para esse problema conhecido do unaccent.
create or replace function agro.unaccent_imutavel(text)
returns text
language sql
immutable
parallel safe
as $$
  select unaccent($1)
$$;

create table agro.produtores (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references agro.orgs(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,  -- preenchido no convite
  nome       text not null,
  nome_norm  text generated always as (upper(agro.unaccent_imutavel(nome))) stored,
  cpf_cnpj   text,
  fone       text,
  email      text,
  origem     text not null default 'manual' check (origem in ('manual', 'pdf')),
  criado_em  timestamptz not null default now()
);
create index produtores_org_idx on agro.produtores(org_id);
create index produtores_user_idx on agro.produtores(user_id);
create index produtores_nome_trgm on agro.produtores using gin (nome_norm gin_trgm_ops);

create table agro.propriedades (
  id           uuid primary key default gen_random_uuid(),
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  nome         text not null,
  nome_norm    text generated always as (upper(agro.unaccent_imutavel(nome))) stored,
  municipio    text,
  uf           text default 'ES',
  car          text,
  area_total   numeric(10,2),
  lat          numeric(10,6),
  lng          numeric(10,6),
  criado_em    timestamptz not null default now()
);
create index propriedades_produtor_idx on agro.propriedades(produtor_id);
create index propriedades_nome_trgm on agro.propriedades using gin (nome_norm gin_trgm_ops);

create table agro.talhoes (
  id              uuid primary key default gen_random_uuid(),
  propriedade_id  uuid not null references agro.propriedades(id) on delete cascade,
  nome            text not null,
  nome_norm       text generated always as (upper(agro.unaccent_imutavel(nome))) stored,
  cultura         text not null,
  variedade       text,
  area_ha         numeric(10,2),
  prod_esperada   numeric(10,2),
  espacamento     text,
  ano_implantacao int,
  geom            jsonb,          -- GeoJSON do contorno, quando houver
  obs             text,
  criado_em       timestamptz not null default now()
);
create index talhoes_propriedade_idx on agro.talhoes(propriedade_id);
create index talhoes_nome_trgm on agro.talhoes using gin (nome_norm gin_trgm_ops);
