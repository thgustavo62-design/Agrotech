-- 0019 — catálogo de safras
-- Extraído do bloco "0019 — Safras e produção" de docs/DATABASE_CHANGES.md:
-- só a tabela agro.safras nasce aqui. `producao_registros` fica para quando a
-- Fase 7 (Produção e safra) for de fato implementada — ver nota em
-- DATABASE_CHANGES.md. `safras` precisa existir agora porque
-- `financeiro_lancamentos`/`financeiro_orcamentos` (0020) referenciam
-- `safra_id`, e a decisão de arquitetura é um catálogo só, compartilhado
-- entre financeiro e produção (PRODUCT_V2.md §2, item 5).

create table agro.safras (
  id          uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  nome        text not null,              -- ex.: "2025/2026"
  inicio      date,
  fim         date,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index safras_produtor_idx on agro.safras(produtor_id);

alter table agro.safras enable row level security;

create policy safras_dono on agro.safras for all to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));

-- consultor também pode ver/criar safras (é um rótulo de período, não dado
-- sensível; útil para o agrônomo planejar recomendações por safra)
create policy safras_consultor on agro.safras for all to authenticated
  using (exists (
    select 1 from agro.produtores p where p.id = safras.produtor_id
      and p.org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin')
  ))
  with check (exists (
    select 1 from agro.produtores p where p.id = safras.produtor_id
      and p.org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin')
  ));
