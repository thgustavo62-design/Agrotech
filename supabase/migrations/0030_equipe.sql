-- 0030 — equipe do escritório (multiusuário, mesmo acesso — PRODUCT_V2.md §2.3)
-- Decisão já registrada no documento: SEM permissão granular por papel nesta
-- leva. Todo integrante convidado vira role='consultor' (mesmo acesso de
-- hoje, igual a quem cria o escritório); "titulo" é só rótulo cosmético
-- (Proprietário/Agrônomo/Técnico/Assistente, ou texto livre) — não controla
-- nada de RLS. Mesmo desenho de agro.convites (0005/0016), mas sem
-- produtor_id, e com uma função de aceite própria.

alter table agro.profiles add column if not exists titulo text;

create table agro.convites_equipe (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references agro.orgs(id) on delete cascade,
  email       text not null,
  titulo      text,
  token       uuid not null default gen_random_uuid(),
  expira_em   timestamptz not null default (now() + interval '7 days'),
  usado_em    timestamptz,
  criado_por  uuid references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create unique index convites_equipe_token_idx on agro.convites_equipe(token);
create index convites_equipe_org_idx on agro.convites_equipe(org_id);

alter table agro.convites_equipe enable row level security;
create policy tenant_guard on agro.convites_equipe as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy consultor on agro.convites_equipe for all to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'))
  with check ((select agro.jwt_role()) in ('consultor', 'admin'));

-- profiles já tinha select de toda a org pro consultor (profiles_org, 0007) —
-- faltava update pra permitir editar título ou remover (org_id = null) um
-- colega da própria equipe. "with check" trava reatribuição pra org de
-- terceiro: só permite manter a mesma org ou zerar (saída).
create policy profiles_atualiza_org on agro.profiles
for update to authenticated
using (org_id = agro.meu_org_id() and agro.sou_consultor())
with check ((org_id = agro.meu_org_id() or org_id is null) and agro.sou_consultor());

create or replace function agro.aceitar_convite_equipe(p_token uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = agro, public
as $$
declare
  cv     agro.convites_equipe;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sem sessão' using errcode = 'insufficient_privilege';
  end if;

  select * into cv
  from agro.convites_equipe
  where token = p_token
    and usado_em is null
    and expira_em > now();

  if not found then
    return null;                       -- token inválido, usado ou expirado
  end if;

  update agro.profiles
     set org_id = cv.org_id, role = 'consultor', titulo = cv.titulo
   where id = v_user;

  update agro.convites_equipe set usado_em = now() where id = cv.id;

  return cv.org_id;
end;
$$;
grant execute on function agro.aceitar_convite_equipe(uuid) to authenticated;

-- espelha o convite pra leitura anônima da validade, igual a convite_resumo
create or replace function agro.convite_equipe_resumo(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = agro, public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'valido', (c.usado_em is null and c.expira_em > now()),
    'organizacao', (select nome from agro.orgs where id = c.org_id),
    'titulo', c.titulo,
    'email', c.email
  ) end
  from (select * from agro.convites_equipe where token = p_token) c
$$;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
