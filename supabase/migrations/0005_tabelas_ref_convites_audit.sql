-- 0005 — tabelas de referência por organização, convites e trilha de auditoria

create table agro.tabelas_referencia (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references agro.orgs(id) on delete cascade,
  tipo           text not null
                 check (tipo in ('faixas', 'fosforo', 'culturas', 'fertilizantes', 'pragas')),
  conteudo       jsonb not null,
  versao         int not null default 1,
  atualizado_em  timestamptz not null default now(),
  unique (org_id, tipo)
);

create trigger tabelas_referencia_touch
  before update on agro.tabelas_referencia
  for each row execute function agro.touch_atualizado_em();

create table agro.convites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  email        text not null,
  token        uuid not null default gen_random_uuid(),
  expira_em    timestamptz not null default (now() + interval '7 days'),
  usado_em     timestamptz,
  criado_por   uuid references auth.users(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create unique index convites_token_idx on agro.convites(token);
create index convites_produtor_idx on agro.convites(produtor_id);

create table agro.audit_log (
  id           bigserial primary key,
  org_id       uuid,
  user_id      uuid,
  acao         text not null,          -- ex.: recomendacao.emitida, laudo.campo_corrigido
  entidade     text,
  entidade_id  uuid,
  dados        jsonb,                  -- {de: ..., para: ...} nas correções
  criado_em    timestamptz not null default now()
);
create index audit_log_org_idx on agro.audit_log(org_id, criado_em desc);
