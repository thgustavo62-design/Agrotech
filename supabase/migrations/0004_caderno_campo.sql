-- 0004 — caderno de campo (monitoramento)

create table agro.visitas (
  id             uuid primary key default gen_random_uuid(),
  talhao_id      uuid not null references agro.talhoes(id) on delete cascade,
  consultor_id   uuid references auth.users(id) on delete set null,
  data           date not null,
  fenologia      text,
  condicao       text check (condicao in ('Boa', 'Regular', 'Preocupante')),
  observacoes    text,
  recomendacao   text,
  proxima_visita date,
  criado_em      timestamptz not null default now()
);
create index visitas_talhao_idx on agro.visitas(talhao_id);
create index visitas_data_idx on agro.visitas(data desc);

create table agro.visita_ocorrencias (
  id           uuid primary key default gen_random_uuid(),
  visita_id    uuid not null references agro.visitas(id) on delete cascade,
  alvo         text not null,
  valor        text,
  acima_nivel  boolean not null default false
);
create index visita_ocorrencias_visita_idx on agro.visita_ocorrencias(visita_id);

create table agro.visita_fotos (
  id            uuid primary key default gen_random_uuid(),
  visita_id     uuid not null references agro.visitas(id) on delete cascade,
  storage_path  text not null,           -- visitas/{org_id}/{visita_id}/{uuid}.jpg
  legenda       text,
  lat           numeric(10,6),
  lng           numeric(10,6),
  criado_em     timestamptz not null default now()
);
create index visita_fotos_visita_idx on agro.visita_fotos(visita_id);
