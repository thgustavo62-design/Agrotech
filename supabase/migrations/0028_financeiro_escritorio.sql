-- 0028 — financeiro do escritório (consultor)
-- "Financeiro do escritório" ficava como item de menu reservado (embreve)
-- desde a Fase 1 — Gustavo pediu pra construir de verdade. Mesmo desenho de
-- 0020 (financeiro do produtor), mas escopado por org_id em vez de
-- produtor_id, e SEM NENHUMA política de produtor: é o dinheiro do próprio
-- escritório (cobrança dos clientes por serviço prestado + despesas do
-- negócio) — isolamento total na direção oposta de 0020.

create table agro.financeiro_escrit_categorias (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references agro.orgs(id) on delete cascade,
  nome      text not null,
  tipo      text not null check (tipo in ('receita','despesa')),
  padrao    boolean not null default false,
  criado_em timestamptz not null default now()
);
create index financeiro_escrit_categorias_org_idx on agro.financeiro_escrit_categorias(org_id);

create table agro.financeiro_escrit_contas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'corrente' check (tipo in ('corrente','poupanca','caixa','outro')),
  saldo_inicial numeric(14,2) not null default 0,
  criado_em     timestamptz not null default now()
);
create index financeiro_escrit_contas_org_idx on agro.financeiro_escrit_contas(org_id);

create table agro.financeiro_escrit_lancamentos (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references agro.orgs(id) on delete cascade,
  conta_id         uuid references agro.financeiro_escrit_contas(id) on delete set null,
  categoria_id     uuid references agro.financeiro_escrit_categorias(id) on delete set null,
  produtor_id      uuid references agro.produtores(id) on delete set null, -- receita de cobrança a um cliente específico (opcional)
  tipo             text not null check (tipo in ('receita','despesa')),
  descricao        text not null,
  valor            numeric(14,2) not null check (valor >= 0),
  data             date not null,
  vencimento       date,
  status           text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  comprovante_path text,          -- storage: financeiro-escritorio/{org_id}/{uuid}.ext
  observacao       text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index financeiro_escrit_lanc_org_idx on agro.financeiro_escrit_lancamentos(org_id, data desc);
create index financeiro_escrit_lanc_status_idx on agro.financeiro_escrit_lancamentos(org_id, status) where status in ('pendente','atrasado');
create trigger financeiro_escrit_lancamentos_touch before update on agro.financeiro_escrit_lancamentos
  for each row execute function agro.touch_atualizado_em();

alter table agro.financeiro_escrit_categorias enable row level security;
alter table agro.financeiro_escrit_contas enable row level security;
alter table agro.financeiro_escrit_lancamentos enable row level security;

create policy tenant_guard on agro.financeiro_escrit_categorias as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy tenant_guard on agro.financeiro_escrit_contas as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy tenant_guard on agro.financeiro_escrit_lancamentos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));

-- só consultor/admin — NENHUMA política de produtor em nenhuma tabela acima
create policy consultor on agro.financeiro_escrit_categorias for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy consultor on agro.financeiro_escrit_contas for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
create policy consultor on agro.financeiro_escrit_lancamentos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));

-- categorias padrão, semeadas quando o escritório acessa o financeiro pela 1ª vez
create or replace function agro.semear_categorias_financeiras_escritorio(p_org uuid)
returns void language plpgsql security definer set search_path = agro, public as $$
begin
  if exists (select 1 from agro.financeiro_escrit_categorias where org_id = p_org) then
    return;
  end if;
  insert into agro.financeiro_escrit_categorias (org_id, nome, tipo, padrao)
  select p_org, nome, tipo, true from (values
    ('Consultoria técnica','receita'), ('Laudos e análises','receita'), ('Outras receitas','receita'),
    ('Combustível','despesa'), ('Equipamentos','despesa'), ('Software e assinaturas','despesa'),
    ('Salários','despesa'), ('Aluguel','despesa'), ('Material de escritório','despesa'),
    ('Marketing','despesa'), ('Contabilidade','despesa'), ('Outros','despesa')
  ) as padrao(nome, tipo);
end $$;
grant execute on function agro.semear_categorias_financeiras_escritorio(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- storage: comprovante de lançamento — mesmo padrão do bucket 'financeiro' de
-- 0020, aqui isolado por org_id em vez de produtor_id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('financeiro-escritorio', 'financeiro-escritorio', false)
on conflict (id) do nothing;

create policy financeiro_escrit_comprovante_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'financeiro-escritorio'
  and (storage.foldername(name))[1] = (select agro.jwt_org())::text
);

create policy financeiro_escrit_comprovante_envio on storage.objects
for insert to authenticated
with check (
  bucket_id = 'financeiro-escritorio'
  and (storage.foldername(name))[1] = (select agro.jwt_org())::text
);

create policy financeiro_escrit_comprovante_exclusao on storage.objects
for delete to authenticated
using (
  bucket_id = 'financeiro-escritorio'
  and (storage.foldername(name))[1] = (select agro.jwt_org())::text
);
