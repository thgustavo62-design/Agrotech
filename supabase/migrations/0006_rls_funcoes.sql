-- 0006 — funções auxiliares de RLS
-- security definer: leem profiles/produtores ignorando a RLS dessas tabelas,
-- mas são estáveis e só devolvem o vínculo do próprio auth.uid().

create or replace function agro.meu_org_id()
returns uuid
language sql
stable
security definer
set search_path = agro, public
as $$
  select org_id from agro.profiles where id = auth.uid()
$$;

create or replace function agro.meu_role()
returns text
language sql
stable
security definer
set search_path = agro, public
as $$
  select role from agro.profiles where id = auth.uid()
$$;

create or replace function agro.meu_produtor_id()
returns uuid
language sql
stable
security definer
set search_path = agro, public
as $$
  select id from agro.produtores where user_id = auth.uid()
$$;

-- atalho: consultor ou admin da organização
create or replace function agro.sou_consultor()
returns boolean
language sql
stable
as $$
  select agro.meu_role() in ('consultor', 'admin')
$$;
