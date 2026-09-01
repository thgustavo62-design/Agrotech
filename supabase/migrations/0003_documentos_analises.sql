-- 0003 — ingestão de laudo, análises e recomendações

create type agro.doc_status as enum
  ('recebido', 'extraindo', 'extraido', 'revisao', 'confirmado', 'erro');

create table agro.documentos (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references agro.orgs(id) on delete cascade,
  enviado_por      uuid references auth.users(id) on delete set null,
  storage_path     text not null,           -- laudos/{org_id}/{produtor_id|_}/{uuid}.pdf
  nome_arquivo     text,
  hash_sha256      text,                    -- evita reprocessar o mesmo PDF
  paginas          int,
  laboratorio      text,                    -- detectado
  texto_extraido   text,
  payload          jsonb,                   -- campos extraídos + confiança por campo
  confianca_media  numeric(4,3),
  status           agro.doc_status not null default 'recebido',
  erro             text,
  criado_em        timestamptz not null default now(),
  processado_em    timestamptz,
  unique (org_id, hash_sha256)
);
create index documentos_org_status_idx on agro.documentos(org_id, status);

create table agro.analises (
  id            uuid primary key default gen_random_uuid(),
  talhao_id     uuid not null references agro.talhoes(id) on delete cascade,
  documento_id  uuid references agro.documentos(id) on delete set null,
  origem        text not null default 'manual' check (origem in ('manual', 'pdf')),
  data_coleta   date not null,
  profundidade  text not null default '0-20',
  laboratorio   text,
  protocolo     text,

  -- parâmetros (mesmos nomes do motor agro-core)
  argila numeric(6,2),
  ph     numeric(4,2),
  mo     numeric(6,2),
  p      numeric(8,2),
  k      numeric(8,2),
  na     numeric(8,2),
  ca     numeric(6,3),
  mg     numeric(6,3),
  al     numeric(6,3),
  h_al   numeric(6,3),
  s      numeric(8,2),
  b      numeric(8,3),
  zn     numeric(8,2),
  cu     numeric(8,2),
  mn     numeric(8,2),
  fe     numeric(8,2),

  prnt          numeric(5,2) default 85,
  incorporacao  int default 20,
  prod_esperada numeric(10,2),

  arquivado_em  timestamptz,               -- exclusão lógica (doc §14 retenção)
  criado_em     timestamptz not null default now(),

  -- auditoria A7: faixas fisicamente plausíveis também no banco
  constraint ph_plausivel     check (ph is null or ph between 3 and 9),
  constraint argila_plausivel check (argila is null or argila between 0 and 100),
  constraint ca_plausivel     check (ca is null or ca between 0 and 30),
  constraint mg_plausivel      check (mg is null or mg between 0 and 30),
  constraint al_plausivel      check (al is null or al between 0 and 30),
  constraint hal_plausivel     check (h_al is null or h_al between 0 and 50),
  constraint p_plausivel       check (p is null or p between 0 and 500),
  constraint k_plausivel       check (k is null or k between 0 and 2000)
);
create index analises_talhao_idx on agro.analises(talhao_id);
create index analises_documento_idx on agro.analises(documento_id);

create table agro.recomendacoes (
  id                uuid primary key default gen_random_uuid(),
  analise_id        uuid not null references agro.analises(id) on delete cascade,
  motor_versao      text not null,          -- semver do agro-core que gerou
  tabelas_snapshot  jsonb not null,         -- cópia das tabelas no momento do cálculo
  resultado         jsonb not null,         -- calagem, gessagem, npk, fontes, diagnóstico
  observacoes       text,
  emitida_por       uuid references auth.users(id) on delete set null,
  emitida_em        timestamptz not null default now(),
  arquivada_em      timestamptz,
  pdf_path          text
);
create index recomendacoes_analise_idx on agro.recomendacoes(analise_id);
