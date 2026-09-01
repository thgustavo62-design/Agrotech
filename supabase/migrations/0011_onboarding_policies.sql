-- 0011 — políticas que faltavam para o onboarding do consultor
-- Um consultor recém-cadastrado (profiles.org_id ainda null) precisa criar a
-- própria organização e semear as tabelas de referência. Depois disso,
-- meu_org_id() deixa de ser null e ele não cria outra.

create policy orgs_criar on agro.orgs
for insert to authenticated
with check (
  agro.meu_role() in ('consultor', 'admin')
  and agro.meu_org_id() is null
);

-- (a atualização de profiles.org_id já é permitida por profiles_atualiza_proprio,
--  que casa id = auth.uid())
