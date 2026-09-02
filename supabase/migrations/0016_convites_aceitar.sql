-- 0016 — aceite de convite do produtor (portal do produtor, Fase 4)
-- O consultor gera o convite (agro.convites). O produtor abre o link, cria a
-- senha e chama esta função — que faz o vínculo em uma transação, como definer,
-- porque o produtor recém-criado ainda não enxerga nada pela RLS.

create or replace function agro.aceitar_convite(p_token uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = agro, public
as $$
declare
  cv       agro.convites;
  v_user   uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sem sessão' using errcode = 'insufficient_privilege';
  end if;

  select * into cv
  from agro.convites
  where token = p_token
    and usado_em is null
    and expira_em > now();

  if not found then
    return null;                       -- token inválido, usado ou expirado
  end if;

  -- vincula o usuário ao produtor e à organização
  update agro.produtores set user_id = v_user where id = cv.produtor_id;
  update agro.profiles
     set org_id = cv.org_id, role = 'produtor'
   where id = v_user;

  update agro.convites set usado_em = now() where id = cv.id;

  return cv.produtor_id;
end;
$$;

grant execute on function agro.aceitar_convite(uuid) to authenticated;

-- espelha o convite para leitura anônima só da validade (a tela mostra "convite
-- de <organização>" antes do login). Não expõe nada sensível.
create or replace function agro.convite_resumo(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = agro, public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'valido', (c.usado_em is null and c.expira_em > now()),
    'organizacao', (select nome from agro.orgs where id = c.org_id),
    'produtor', (select nome from agro.produtores where id = c.produtor_id),
    'email', c.email
  ) end
  from (select * from agro.convites where token = p_token) c
$$;

grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
