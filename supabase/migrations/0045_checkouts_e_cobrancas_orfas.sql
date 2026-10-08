-- 0045 — pagamento só ativa o escritório certo (AG-010)
--
-- Defeitos achados lendo o fluxo de cobrança (nunca testado com conta Asaas real):
--   1. o checkout criava um link no Asaas e não guardava NADA que ligasse o pagamento ao escritório; o webhook procurava a
--      assinatura por gateway_customer_id/gateway_subscription_id, que ninguém preenchia → nenhum pagamento casava;
--   2. o webhook só mudava o STATUS: o plano ficava "teste" mesmo depois de pago;
--   3. pagamento sem assinatura casada era gravado em cobrancas com org_id nulo, mas a coluna é NOT NULL → o webhook falhava
--      e (como respondia 200 sem checar) o evento se perdia.
-- Agora: cada checkout gera uma linha (escritório, plano, valor esperado, id do link no Asaas); o webhook casa o pagamento
-- pelo link, confere o valor e só então ativa e troca o plano; o que não casa fica em quarentena (cobrancas_orfas) para
-- reconciliação manual.

create table if not exists agro.checkouts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references agro.orgs(id) on delete cascade,
  plano_id         text not null references agro.planos(id),
  gateway_link_id  text not null unique,           -- id do link de pagamento no Asaas
  valor_esperado   numeric(10,2) not null check (valor_esperado >= 0),
  criado_por       uuid references auth.users(id) on delete set null,
  usado_em         timestamptz,                    -- quando o primeiro pagamento confirmou
  criado_em        timestamptz not null default now()
);
create index if not exists checkouts_org_idx on agro.checkouts(org_id, criado_em desc);

alter table agro.checkouts enable row level security;
-- só quem gerencia o plano (proprietário) enxerga e registra checkouts do próprio escritório
create policy checkouts_ler on agro.checkouts for select to authenticated
  using (org_id = (select agro.jwt_org()) and (select agro.pode('plano.gerenciar')));
create policy checkouts_criar on agro.checkouts for insert to authenticated
  with check (org_id = (select agro.jwt_org()) and (select agro.pode('plano.gerenciar')));
-- (atualizar/apagar: só a service_role, pelo webhook)

-- pagamentos que não puderam ser ligados com segurança a um escritório: ninguém lê pelo cliente
create table if not exists agro.cobrancas_orfas (
  id          uuid primary key default gen_random_uuid(),
  gateway_id  text not null,
  evento      text not null,
  motivo      text not null,
  payload     jsonb not null,
  criado_em   timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists cobrancas_orfas_gateway_idx on agro.cobrancas_orfas(gateway_id);
alter table agro.cobrancas_orfas enable row level security;
-- sem nenhuma política: só a service_role (que ignora a RLS) lê e grava

grant select, insert on agro.checkouts to authenticated;
grant all on agro.checkouts, agro.cobrancas_orfas to service_role;

-- índices das chaves estrangeiras (o teste do catálogo exige) e negação explícita na quarentena
create index if not exists checkouts_plano_idx on agro.checkouts(plano_id);
create index if not exists checkouts_criado_por_idx on agro.checkouts(criado_por);
create policy cobrancas_orfas_negar on agro.cobrancas_orfas for all to authenticated using (false) with check (false);
