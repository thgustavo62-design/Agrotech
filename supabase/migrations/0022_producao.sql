-- 0022 — Fase 7: produção e safra
-- Extraído do bloco "0019 — Safras e produção" de docs/DATABASE_CHANGES.md
-- (a parte "agro.safras" já nasceu em 0019_safras.sql, pré-requisito do
-- financeiro). Aqui entra o resto: agro.producao_registros.
--
-- Decisão #2 de DATABASE_CHANGES.md: os campos agronômicos (área, produção
-- prevista/realizada, talhão, safra) ficam visíveis ao consultor em modo
-- leitura — fecha o ciclo esperado×realizado sinalizado como lacuna em
-- AUDITORIA-02.md. Os campos comerciais (preço, receita, observação) NUNCA
-- saem da tabela para o consultor. A proposta original só previa uma
-- política de SELECT "de tabela inteira" pra consultor, que teria exposto
-- os campos comerciais também — RLS não filtra coluna, só linha. Aqui isso
-- é corrigido de verdade: a tabela base não tem NENHUMA política de
-- consultor; o consultor só enxerga produção via a function
-- agro.producao_visivel_consultor(), que nem seleciona preco_medio/
-- receita_obtida/observacao no seu retorno.

create table agro.producao_registros (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references agro.orgs(id) on delete cascade,
  produtor_id         uuid not null references agro.produtores(id) on delete cascade,
  talhao_id           uuid references agro.talhoes(id) on delete set null,
  safra_id            uuid references agro.safras(id) on delete set null,
  cultura             text,                      -- espelha talhoes.cultura no momento do registro
  area_ha             numeric(10,2),
  producao_prevista   numeric(12,2),
  producao_realizada  numeric(12,2),
  unidade             text default 'sc',         -- sc | t | kg | un — texto livre com sugestão na UI
  preco_medio         numeric(12,2),
  receita_obtida      numeric(14,2),
  observacao          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index producao_produtor_idx on agro.producao_registros(produtor_id);
create index producao_talhao_idx on agro.producao_registros(talhao_id);
create index producao_safra_idx on agro.producao_registros(safra_id);
create trigger producao_registros_touch before update on agro.producao_registros
  for each row execute function agro.touch_atualizado_em();

-- herda org_id do produtor — FK já é direta (não passa por propriedade),
-- então ganha uma função auxiliar mais simples que agro.herdar_de_produtor()
-- (0012, que lê propriedades.produtor_id)
create or replace function agro.herdar_de_produtor_direto() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from agro.produtores where id = new.produtor_id;
  return new;
end $$;
create trigger producao_registros_herda before insert on agro.producao_registros
  for each row execute function agro.herdar_de_produtor_direto();

alter table agro.producao_registros enable row level security;
create policy tenant_guard on agro.producao_registros as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
-- produtor: CRUD completo dos próprios registros (todas as colunas)
create policy producao_dono on agro.producao_registros for all to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));
-- SEM política de consultor aqui de propósito — ver nota de segurança acima.

-- leitura do consultor: só os campos agronômicos, nunca preço/receita/observação
create or replace function agro.producao_visivel_consultor()
returns table (
  id uuid, produtor_id uuid, talhao_id uuid, safra_id uuid,
  cultura text, area_ha numeric, producao_prevista numeric, producao_realizada numeric,
  unidade text, criado_em timestamptz
)
language sql stable security definer set search_path = agro, public as $$
  select r.id, r.produtor_id, r.talhao_id, r.safra_id, r.cultura, r.area_ha,
         r.producao_prevista, r.producao_realizada, r.unidade, r.criado_em
  from agro.producao_registros r
  where r.org_id = (select agro.jwt_org())
    and (select agro.jwt_role()) in ('consultor','admin')
$$;
grant execute on function agro.producao_visivel_consultor() to authenticated;
