-- 0009 — casamento de nomes por trigrama (cadastro assistido a partir do laudo)
-- Mesma lógica de similaridade usada no Sincronizador para casar produto.

-- remove prefixos que só atrapalham a comparação
create or replace function agro.normalizar_nome(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    trim(both ' ' from
      regexp_replace(
        upper(unaccent(coalesce(p, ''))),
        '\m(FAZENDA|SITIO|CHACARA|PROP\.?|SR\.?|SRA\.?|AGROPECUARIA|GRANJA)\M',
        '', 'g'
      )
    ),
    '\s+', ' ', 'g'
  )
$$;

create or replace function agro.casar_produtor(p_org uuid, p_nome text)
returns table (id uuid, nome text, score real)
language sql
stable
security definer
set search_path = agro, public
as $$
  select p.id,
         p.nome,
         similarity(agro.normalizar_nome(p.nome), agro.normalizar_nome(p_nome)) as score
  from agro.produtores p
  where p.org_id = p_org
    and agro.normalizar_nome(p.nome) % agro.normalizar_nome(p_nome)
  order by score desc
  limit 5
$$;

-- Regras de decisão (aplicadas na camada de aplicação, não no banco):
--   score >= 0,90  -> vincula automaticamente
--   0,60 a 0,89    -> pergunta ao agrônomo
--   < 0,60         -> propõe cadastro novo
