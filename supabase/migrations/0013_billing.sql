-- 0013 — cobrança (Asaas) e limite de plano cobrado pelo banco
-- Ver docs/PRODUTO-VENDAVEL.md §4.

create table agro.planos (
  id             text primary key,          -- 'teste' | 'tecnico' | 'escritorio'
  nome           text not null,
  preco_mes      numeric(10,2) not null default 0,
  lim_produtores int not null,
  lim_talhoes    int not null,
  lim_laudos_mes int not null,
  ativo          boolean not null default true,
  ordem          int not null default 0
);

insert into agro.planos (id, nome, preco_mes, lim_produtores, lim_talhoes, lim_laudos_mes, ordem) values
  ('teste',      'Teste (14 dias)',   0,    5,   20,   10, 0),
  ('tecnico',    'Técnico',           149,  30,  150,  60, 1),
  ('escritorio', 'Escritório',        349,  150, 800,  300, 2)
on conflict (id) do nothing;

create table agro.assinaturas (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null unique references agro.orgs(id) on delete cascade,
  plano                  text not null references agro.planos(id),
  status                 text not null default 'trial'
                         check (status in ('trial', 'ativa', 'suspensa', 'cancelada')),
  gateway                text not null default 'asaas',
  gateway_customer_id    text,
  gateway_subscription_id text,
  trial_expira_em        timestamptz default (now() + interval '14 days'),
  atual_ate              date,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
create trigger assinaturas_touch before update on agro.assinaturas
  for each row execute function agro.touch_atualizado_em();

create table agro.cobrancas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  assinatura_id uuid references agro.assinaturas(id) on delete set null,
  gateway_id    text not null,               -- id da cobrança no Asaas
  valor         numeric(10,2),
  status        text,                        -- PENDING | RECEIVED | OVERDUE | REFUNDED ...
  metodo        text,                        -- PIX | BOLETO | CREDIT_CARD
  vencimento    date,
  pago_em       timestamptz,
  criado_em     timestamptz not null default now(),
  unique (gateway_id)                        -- idempotência do webhook
);
create index cobrancas_org_idx on agro.cobrancas(org_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table agro.planos enable row level security;
create policy planos_leitura on agro.planos for select to authenticated using (ativo);

alter table agro.assinaturas enable row level security;
create policy assinaturas_consultor on agro.assinaturas for select to authenticated
  using (org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor', 'admin'));
-- o onboarding cria a assinatura de teste; a unique(org_id) impede duplicata.
-- Mudança de status/plano é só via service_role (webhook do Asaas).
create policy assinaturas_criar on agro.assinaturas for insert to authenticated
  with check (org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor', 'admin'));

alter table agro.cobrancas enable row level security;
create policy cobrancas_consultor on agro.cobrancas for select to authenticated
  using (org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor', 'admin'));

-- ---------------------------------------------------------------------------
-- limite de plano — recusa no banco, com mensagem legível
-- ---------------------------------------------------------------------------
create or replace function agro.checar_limite() returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
declare
  v_org   uuid;
  v_ass   agro.assinaturas;
  v_plano agro.planos;
  v_qtd   int;
begin
  -- resolve a organização conforme a tabela
  if tg_table_name = 'produtores' then
    v_org := new.org_id;
  elsif tg_table_name = 'talhoes' then
    select org_id into v_org from agro.propriedades where id = new.propriedade_id;
  elsif tg_table_name = 'documentos' then
    v_org := new.org_id;
  end if;

  if v_org is null then
    return new;                               -- sem org resolvida: não bloqueia
  end if;

  select * into v_ass from agro.assinaturas where org_id = v_org;
  if not found then
    return new;                               -- org sem assinatura: grace
  end if;

  if v_ass.status in ('cancelada', 'suspensa')
     or (v_ass.status = 'trial' and v_ass.trial_expira_em is not null and v_ass.trial_expira_em < now())
  then
    raise exception 'Assinatura % — regularize o pagamento para cadastrar novos registros. Os dados existentes continuam acessíveis.', v_ass.status
      using errcode = 'check_violation';
  end if;

  select * into v_plano from agro.planos where id = v_ass.plano;

  if tg_table_name = 'produtores' then
    select count(*) into v_qtd from agro.produtores where org_id = v_org;
    if v_qtd >= v_plano.lim_produtores then
      raise exception 'Limite do plano % atingido: % produtores. Faça upgrade.', v_plano.nome, v_plano.lim_produtores
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'talhoes' then
    select count(*) into v_qtd from agro.talhoes where org_id = v_org;
    if v_qtd >= v_plano.lim_talhoes then
      raise exception 'Limite do plano % atingido: % talhões. Faça upgrade.', v_plano.nome, v_plano.lim_talhoes
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'documentos' then
    select count(*) into v_qtd from agro.documentos
     where org_id = v_org and criado_em >= date_trunc('month', now());
    if v_qtd >= v_plano.lim_laudos_mes then
      raise exception 'Limite do plano % atingido: % laudos neste mês. Faça upgrade.', v_plano.nome, v_plano.lim_laudos_mes
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger zzz_checar_limite before insert on agro.produtores
  for each row execute function agro.checar_limite();
create trigger zzz_checar_limite before insert on agro.talhoes
  for each row execute function agro.checar_limite();
create trigger zzz_checar_limite before insert on agro.documentos
  for each row execute function agro.checar_limite();
