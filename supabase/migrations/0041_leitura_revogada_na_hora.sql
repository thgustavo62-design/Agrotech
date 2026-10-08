-- 0041 — quem foi removido perde a LEITURA na hora, não só a escrita
--
-- AG-005. Em 0039 a escrita já caía imediatamente (agro.pode lê o perfil), mas toda política de LEITURA confia no
-- org_id do JWT (agro.jwt_org), e o JWT só expira em até 1 hora: um empregado removido ainda lia produtores, análises
-- e arquivos com o token antigo.
--
-- Agora o escritório (e o papel) valem o que está no PERFIL no momento da consulta, e conta desativada não tem
-- escritório nem papel — logo, nenhuma política de RLS (tabelas e Storage) deixa passar. O perfil passa a ser a fonte
-- da verdade; o claim do token só é usado quando não há perfil (chamadas de serviço, sem auth.uid()).
-- Medido no PGlite com 20 000 análises: sem diferença de tempo (consulta por chave primária, uma por comando).
--
-- create or replace mantém as permissões das funções; nenhuma função nova.

create or replace function agro.jwt_org() returns uuid
language sql stable security definer set search_path = agro, public as $$
  select case
    when p.id is null then nullif(auth.jwt() ->> 'org_id', '')::uuid     -- sem perfil (serviço): vale o claim
    when p.desativado_em is not null then null                            -- conta desativada: sem escritório
    else p.org_id                                                         -- o perfil manda, não o token velho
  end
  from (select 1) base
  left join agro.profiles p on p.id = auth.uid()
$$;

create or replace function agro.jwt_role() returns text
language sql stable security definer set search_path = agro, public as $$
  select case
    when p.id is null then nullif(auth.jwt() ->> 'user_role', '')
    when p.desativado_em is not null then null
    else p.role
  end
  from (select 1) base
  left join agro.profiles p on p.id = auth.uid()
$$;
