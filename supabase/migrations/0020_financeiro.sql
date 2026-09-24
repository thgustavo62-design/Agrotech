-- 0020 — financeiro do produtor
-- Igual ao bloco "0020 — Financeiro do produtor" de docs/DATABASE_CHANGES.md,
-- mais o bucket de comprovantes (não estava na proposta original — ver nota
-- de divergência em DATABASE_CHANGES.md).
--
-- Isolamento total: nenhuma política de consultor/admin em nenhuma tabela
-- abaixo. Por decisão de produto (PRODUCT_V2.md §2.2), o consultor não tem
-- acesso — nem leitura — ao financeiro do produtor.

create table agro.financeiro_categorias (
  id          uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('receita','despesa')),
  padrao      boolean not null default false,  -- semeada automaticamente, não apagável pela UI
  criado_em   timestamptz not null default now()
);
create index financeiro_categorias_produtor_idx on agro.financeiro_categorias(produtor_id);

create table agro.financeiro_centros_custo (
  id             uuid primary key default gen_random_uuid(),
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  nome           text not null,
  propriedade_id uuid references agro.propriedades(id) on delete set null,
  talhao_id      uuid references agro.talhoes(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index financeiro_centros_custo_produtor_idx on agro.financeiro_centros_custo(produtor_id);

create table agro.financeiro_contas (
  id             uuid primary key default gen_random_uuid(),
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  nome           text not null,                 -- "Caixa", "Banco do Brasil"
  tipo           text not null default 'corrente' check (tipo in ('corrente','poupanca','caixa','outro')),
  saldo_inicial  numeric(14,2) not null default 0,
  criado_em      timestamptz not null default now()
);
create index financeiro_contas_produtor_idx on agro.financeiro_contas(produtor_id);

create table agro.financeiro_lancamentos (
  id              uuid primary key default gen_random_uuid(),
  produtor_id     uuid not null references agro.produtores(id) on delete cascade,
  conta_id        uuid references agro.financeiro_contas(id) on delete set null,
  categoria_id    uuid references agro.financeiro_categorias(id) on delete set null,
  centro_custo_id uuid references agro.financeiro_centros_custo(id) on delete set null,
  propriedade_id  uuid references agro.propriedades(id) on delete set null,
  talhao_id       uuid references agro.talhoes(id) on delete set null,
  safra_id        uuid references agro.safras(id) on delete set null,
  tipo            text not null check (tipo in ('receita','despesa')),
  descricao       text not null,
  valor           numeric(14,2) not null check (valor >= 0),
  data            date not null,
  vencimento      date,
  status          text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  comprovante_path text,          -- storage: financeiro/{produtor_id}/{uuid}.ext
  observacao      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index financeiro_lanc_produtor_idx on agro.financeiro_lancamentos(produtor_id, data desc);
create index financeiro_lanc_status_idx on agro.financeiro_lancamentos(produtor_id, status) where status in ('pendente','atrasado');
create trigger financeiro_lancamentos_touch before update on agro.financeiro_lancamentos
  for each row execute function agro.touch_atualizado_em();

create table agro.financeiro_orcamentos (
  id               uuid primary key default gen_random_uuid(),
  produtor_id      uuid not null references agro.produtores(id) on delete cascade,
  categoria_id     uuid references agro.financeiro_categorias(id) on delete cascade,
  safra_id         uuid references agro.safras(id) on delete set null,
  valor_planejado  numeric(14,2) not null,
  criado_em        timestamptz not null default now()
);
create index financeiro_orcamentos_produtor_idx on agro.financeiro_orcamentos(produtor_id);

-- RLS: isolamento total — NENHUMA política de consultor em nenhuma tabela abaixo
alter table agro.financeiro_categorias enable row level security;
alter table agro.financeiro_centros_custo enable row level security;
alter table agro.financeiro_contas enable row level security;
alter table agro.financeiro_lancamentos enable row level security;
alter table agro.financeiro_orcamentos enable row level security;

create policy dono on agro.financeiro_categorias for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_centros_custo for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_contas for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_lancamentos for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_orcamentos for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));

-- Nota de segurança: financeiro_categorias/_contas/_centros_custo não levam
-- org_id nem guarda RESTRICTIVE — a política "dono" já é suficiente (só o
-- produtor_id do próprio usuário) e essas tabelas não têm caminho de acesso
-- por organização. Adicionar org_id aqui seria coluna morta.

-- categorias padrão, semeadas quando o produtor acessa o financeiro pela 1ª vez
-- (chamado pela aplicação, não por trigger — mesmo padrão de garantirEscritorio())
create or replace function agro.semear_categorias_financeiras(p_produtor uuid)
returns void language plpgsql security definer set search_path = agro, public as $$
begin
  if exists (select 1 from agro.financeiro_categorias where produtor_id = p_produtor) then
    return;
  end if;
  insert into agro.financeiro_categorias (produtor_id, nome, tipo, padrao)
  select p_produtor, nome, tipo, true from (values
    ('Venda de produção','receita'), ('Outras receitas','receita'),
    ('Adubo','despesa'), ('Fertilizantes','despesa'), ('Defensivos','despesa'),
    ('Calcário','despesa'), ('Mão de obra','despesa'), ('Combustível','despesa'),
    ('Energia','despesa'), ('Irrigação','despesa'), ('Máquinas','despesa'),
    ('Manutenção','despesa'), ('Transporte','despesa'), ('Colheita','despesa'),
    ('Beneficiamento','despesa'), ('Outros','despesa')
  ) as padrao(nome, tipo);
end $$;
grant execute on function agro.semear_categorias_financeiras(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- storage: comprovante de lançamento (nota fiscal, recibo) — não fazia parte
-- da proposta original em DATABASE_CHANGES.md, adicionado aqui porque o
-- campo comprovante_path só é útil com um bucket de verdade por trás.
-- Caminho: financeiro/{produtor_id}/{uuid}.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('financeiro', 'financeiro', false)
on conflict (id) do nothing;

create policy financeiro_comprovante_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'financeiro'
  and (storage.foldername(name))[1] = (select agro.jwt_produtor())::text
);

create policy financeiro_comprovante_envio on storage.objects
for insert to authenticated
with check (
  bucket_id = 'financeiro'
  and (storage.foldername(name))[1] = (select agro.jwt_produtor())::text
);

create policy financeiro_comprovante_exclusao on storage.objects
for delete to authenticated
using (
  bucket_id = 'financeiro'
  and (storage.foldername(name))[1] = (select agro.jwt_produtor())::text
);
