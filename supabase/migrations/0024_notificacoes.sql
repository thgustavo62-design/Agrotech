-- 0024 — Fase 9: notificações
-- Tabela + leitura por select normal (RLS por destinatário), sem Realtime
-- nesta primeira versão — decisão em PRODUCT_V2.md §2.6 ("badge que
-- revalida no carregamento de página"). Dois gatilhos reais (dos vários
-- possíveis que a proposta original deixava como exemplo): nova
-- recomendação emitida, e evento de agenda tipo "visita" marcado pro
-- produtor. Os demais (nova_analise, documento_disponivel...) ficam pra
-- quando surgir necessidade real de cada um.

create table agro.notificacoes (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references agro.orgs(id) on delete cascade,
  destinatario_user_id  uuid not null references auth.users(id) on delete cascade,
  tipo                  text not null check (tipo in (
                          'nova_recomendacao','nova_analise','visita_agendada',
                          'visita_realizada','documento_disponivel',
                          'atividade_vencendo','conta_vencendo'
                        )),
  titulo    text not null,
  corpo     text,
  link      text,                 -- rota relativa, ex.: /produtor/laudos/{id}
  lida_em   timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_destinatario_idx on agro.notificacoes(destinatario_user_id, lida_em);

alter table agro.notificacoes enable row level security;
create policy notificacoes_dono on agro.notificacoes for select to authenticated
  using (destinatario_user_id = (select auth.uid()));
create policy notificacoes_marcar_lida on agro.notificacoes for update to authenticated
  using (destinatario_user_id = (select auth.uid()))
  with check (destinatario_user_id = (select auth.uid()));
-- inserção só via function security definer abaixo (trigger) — nunca client direto

create or replace function agro.notificar_nova_recomendacao() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user uuid;
  v_org  uuid;
begin
  select p.user_id, p.org_id into v_user, v_org
  from agro.analises a join agro.produtores p on p.id = a.produtor_id
  where a.id = new.analise_id;

  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, link)
    values (v_org, v_user, 'nova_recomendacao', 'Seu agrônomo publicou uma nova recomendação.',
            '/produtor/laudos/' || new.id);
  end if;
  return new;
end $$;

create trigger recomendacoes_notifica after insert on agro.recomendacoes
  for each row execute function agro.notificar_nova_recomendacao();

create or replace function agro.notificar_visita_agendada() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user uuid;
begin
  if new.produtor_id is null or new.tipo <> 'visita' then
    return new;
  end if;
  select user_id into v_user from agro.produtores where id = new.produtor_id;
  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, link)
    values (new.org_id, v_user, 'visita_agendada',
            'Visita técnica marcada para ' || to_char(new.data, 'DD/MM/YYYY') || '.',
            '/produtor');
  end if;
  return new;
end $$;

create trigger agenda_eventos_notifica after insert on agro.agenda_eventos
  for each row execute function agro.notificar_visita_agendada();
