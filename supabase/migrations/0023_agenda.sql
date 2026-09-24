-- 0023 — Fase 9: agenda do agrônomo
-- Igual à proposta em docs/DATABASE_CHANGES.md §0023 (Agenda do agrônomo).
-- Separada de agro.visitas de propósito (decisão #4 do documento): visitas
-- é o registro histórico (depois do fato), agenda_eventos é o agendamento
-- (antes do fato). Um evento concluído pode referenciar a visita_id criada
-- quando cumprido — nesta primeira versão a UI não faz esse vínculo
-- automaticamente (documentado como simplificação em PROGRESSO.md).

create table agro.agenda_eventos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  consultor_id  uuid references auth.users(id) on delete set null,
  produtor_id   uuid references agro.produtores(id) on delete set null,
  talhao_id     uuid references agro.talhoes(id) on delete set null,
  tipo          text not null check (tipo in ('visita','coleta_solo','retorno','aplicacao','reuniao','outro')),
  titulo        text not null,
  data          date not null,
  hora          time,
  status        text not null default 'planejado' check (status in ('planejado','concluido','cancelado')),
  visita_id     uuid references agro.visitas(id) on delete set null,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agenda_org_data_idx on agro.agenda_eventos(org_id, data);
create index agenda_produtor_idx on agro.agenda_eventos(produtor_id) where produtor_id is not null;
create trigger agenda_eventos_touch before update on agro.agenda_eventos
  for each row execute function agro.touch_atualizado_em();

alter table agro.agenda_eventos enable row level security;
create policy tenant_guard on agro.agenda_eventos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy agenda_consultor on agro.agenda_eventos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
-- produtor vê (não edita) os próprios eventos agendados
create policy agenda_produtor_leitura on agro.agenda_eventos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
