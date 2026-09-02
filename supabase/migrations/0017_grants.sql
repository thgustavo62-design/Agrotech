-- 0017 — GRANTs no schema agro
-- O schema não é `public`, então os privilégios de tabela precisam ser dados
-- explicitamente. A RLS (ligada em todas as tabelas) continua sendo a barreira —
-- o GRANT só permite que o PostgREST chegue à tabela para a RLS decidir.

grant usage on schema agro to anon, authenticated;

-- authenticated: acesso a tudo, gated por RLS
grant select, insert, update, delete on all tables in schema agro to authenticated;
grant usage, select on all sequences in schema agro to authenticated;
grant execute on all functions in schema agro to authenticated;

-- anon: nada de tabela (RLS não tem política para anon); só as RPCs públicas,
-- já concedidas em 0010 (resultados_por_token) e 0016 (convite_resumo).

-- novas tabelas/funções herdam os mesmos privilégios
alter default privileges in schema agro
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema agro
  grant usage, select on sequences to authenticated;
alter default privileges in schema agro
  grant execute on functions to authenticated;
