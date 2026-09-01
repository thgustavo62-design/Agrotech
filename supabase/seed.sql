-- seed local (roda em `supabase db reset`). NÃO usar em produção.
-- Usuários de auth são criados pelo Studio ou por `supabase auth` — aqui só
-- deixamos uma organização de demonstração para o desenvolvimento.

insert into agro.orgs (id, nome, municipio, uf, plano)
values ('00000000-0000-0000-0000-0000000000aa', 'Campo Forte — Demonstração', 'Colatina', 'ES', 'pro')
on conflict (id) do nothing;

-- As tabelas de referência de cada organização são semeadas pela aplicação
-- (route handler /cadastro), que importa `clonarPadrao()` de @agrotech/agro-core
-- e grava 5 linhas em agro.tabelas_referencia. Manter uma única fonte da verdade.
