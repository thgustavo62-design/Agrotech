-- 0052 — Avisos no celular (Web Push)
--
-- Cada aparelho que ligar os avisos guarda uma "assinatura" (endereço do serviço de push do navegador + chaves). O servidor da
-- aplicação, com a chave de serviço, manda o aviso quando nasce uma notificação (agro.notificacoes). Quem escreve aqui é o
-- servidor; a pessoa só enxerga e apaga as próprias assinaturas.
--
--   push_assinaturas        uma por aparelho/navegador (endpoint único)
--   notificacoes.push_enviado_em   marca a notificação já tratada pelo envio (evita mandar duas vezes)

create table agro.push_assinaturas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  org_id          uuid references agro.orgs(id) on delete cascade,
  endpoint        text not null unique check (endpoint ~* '^https://[^[:space:]]+$' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) between 20 and 200),
  auth            text not null check (char_length(auth) between 8 and 100),
  user_agent      text check (char_length(user_agent) <= 300),
  falhas          int not null default 0,
  criado_em       timestamptz not null default now(),
  ultimo_envio_em timestamptz
);
create index push_assinaturas_user_idx on agro.push_assinaturas(user_id);
create index push_assinaturas_org_idx on agro.push_assinaturas(org_id);

alter table agro.push_assinaturas enable row level security;
-- a pessoa vê e apaga só as dela; criar/atualizar é com a chave de serviço (a ação do servidor confere quem é)
create policy push_proprias_le on agro.push_assinaturas for select to authenticated using (user_id = (select auth.uid()));
create policy push_proprias_apaga on agro.push_assinaturas for delete to authenticated using (user_id = (select auth.uid()));

-- notificações ainda não tratadas pelo envio (só as recentes interessam; o índice é pequeno)
alter table agro.notificacoes add column if not exists push_enviado_em timestamptz;
create index if not exists notificacoes_push_pendente_idx on agro.notificacoes(criado_em) where push_enviado_em is null;
-- as que já existem não disparam aviso retroativo
update agro.notificacoes set push_enviado_em = now() where push_enviado_em is null;

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- ajudantes internos: só por gatilho
revoke execute on function agro.academy_sincronizar_curso(uuid, uuid) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_equipe(uuid, uuid, text, text, text, text) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_produtor(uuid, uuid, text, text, text, text) from authenticated, service_role;
