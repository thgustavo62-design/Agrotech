-- 0043 — o backup passa a ser restaurável (AG-012)
--
-- O ensaio de restauração diário (backup.yml) achou um defeito real: agro.unaccent_imutavel chamava `unaccent(...)`
-- SEM schema e sem search_path próprio. Na produção funciona (o schema da extensão está no search_path da conexão),
-- mas o pg_restore roda com search_path vazio: a função falhava ao ser recriada ("function unaccent(text) does not
-- exist"), e com ela as tabelas produtores, propriedades e talhões (que a usam em colunas geradas) — ou seja, um
-- backup de produção NÃO restauraria a carteira de clientes.
--
-- Agora a função fixa o próprio search_path (public e extensions cobrem os dois lugares onde a extensão pode estar).
-- Mesma lógica, mesmo resultado: as colunas geradas não precisam ser recalculadas. Nenhuma função nova.

create or replace function agro.unaccent_imutavel(text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select unaccent($1)
$$;
