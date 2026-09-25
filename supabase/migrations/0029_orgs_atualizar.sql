-- 0029 — política de UPDATE em agro.orgs
-- Achado registrado desde a Fase 1 (PRODUCT_AUDIT.md item 14): orgs nunca
-- teve policy de update, então o consultor não conseguia renomear o próprio
-- escritório pelo app (a tela de Configurações já dizia isso explicitamente).
-- Mesmo padrão das políticas existentes de orgs (0007/0011): usa
-- meu_org_id()/meu_role() — que desde 0012 só delegam pra jwt_org()/jwt_role(),
-- então já é JWT-based por baixo, só mantém o nome de função antigo.

create policy orgs_atualizar on agro.orgs
for update to authenticated
using (id = agro.meu_org_id() and agro.meu_role() in ('consultor', 'admin'))
with check (id = agro.meu_org_id() and agro.meu_role() in ('consultor', 'admin'));
