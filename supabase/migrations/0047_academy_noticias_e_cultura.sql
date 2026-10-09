-- 0047 — Academy: notícias do agro (AC-07) e conteúdo por cultura (AC-03)
--
--   Notícia: o escritório escreve o RESUMO com as próprias palavras e aponta a fonte e o link da matéria original.
--            Nada é copiado: sem resumo próprio, sem fonte e sem link, a notícia não publica.
--   Por cultura: visibilidade "cultura" mostra o conteúdo a quem tem talhão daquela cultura ("Café" alcança café-conilon
--            e café-arábica). Vale para talhões criados depois também: a regra é calculada na hora de ler.

-- tipo: + noticia ; visibilidade: + cultura
alter table agro.academy_conteudos drop constraint if exists academy_conteudos_tipo_check;
alter table agro.academy_conteudos add constraint academy_conteudos_tipo_check
  check (tipo in ('video', 'artigo', 'material', 'noticia'));
alter table agro.academy_conteudos drop constraint if exists academy_conteudos_visibilidade_check;
alter table agro.academy_conteudos add constraint academy_conteudos_visibilidade_check
  check (visibilidade in ('todos', 'selecionados', 'cultura'));

alter table agro.academy_conteudos
  add column if not exists data_materia  date,
  add column if not exists regiao        text check (char_length(regiao) <= 80),
  add column if not exists cultura_chave text;

-- "Café", "café ", "CAFÉ-ARÁBICA" → cafe, cafe, cafe-arabica
create or replace function agro.slug_cultura(p_texto text) returns text
language sql immutable parallel safe
set search_path = agro, public
as $$
  select nullif(trim(both '-' from regexp_replace(lower(agro.unaccent_imutavel(coalesce(p_texto, ''))), '[^a-z0-9]+', '-', 'g')), '')
$$;

update agro.academy_conteudos set cultura_chave = agro.slug_cultura(cultura) where cultura is not null;

-- publicar exige o que mostrar; notícia exige resumo próprio, fonte e link
alter table agro.academy_conteudos drop constraint if exists conteudo_publicavel;
alter table agro.academy_conteudos add constraint conteudo_publicavel check (
  status <> 'publicado'
  or case tipo
       when 'video'   then url is not null
       when 'artigo'  then coalesce(btrim(corpo), '') <> ''
       when 'noticia' then url is not null and coalesce(btrim(descricao), '') <> '' and coalesce(btrim(fonte), '') <> ''
       else arquivo_path is not null or url is not null
     end
);
-- "por cultura" sem cultura não alcança ninguém
alter table agro.academy_conteudos add constraint cultura_obrigatoria check (
  visibilidade <> 'cultura' or coalesce(btrim(cultura), '') <> ''
);

-- as regras do banco passam a manter a chave da cultura (mesma função de 0046 + uma linha)
create or replace function agro.academy_conteudos_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_cliente then new.autor_id := auth.uid(); end if;
  else
    if new.org_id is distinct from old.org_id then
      raise exception 'O escritório de um conteúdo não pode ser alterado.' using errcode = '42501';
    end if;
    if v_cliente then new.autor_id := old.autor_id; end if;
  end if;

  new.cultura_chave := agro.slug_cultura(new.cultura);

  if new.arquivo_path is not null and new.arquivo_path not like new.org_id::text || '/%' then
    raise exception 'O arquivo precisa estar na pasta do escritório.' using errcode = '22023';
  end if;

  if new.status = 'publicado' then
    if v_cliente then new.revisado_por := auth.uid(); end if;
    new.revisado_em := now();
    new.publicado_em := coalesce(case when tg_op = 'UPDATE' then old.publicado_em end, now());
  elsif v_cliente and tg_op = 'UPDATE' then
    new.revisado_por := old.revisado_por;
    new.revisado_em := old.revisado_em;
    new.publicado_em := old.publicado_em;
  end if;
  return new;
end $$;

-- leitura do produtor: + "cultura" (tem talhão daquela cultura, exata ou variedade: cafe → cafe-conilon)
drop policy if exists conteudos_produtor on agro.academy_conteudos;
create policy conteudos_produtor on agro.academy_conteudos for select to authenticated
  using (
    status = 'publicado'
    and (
      visibilidade = 'todos'
      or (visibilidade = 'cultura' and exists (
            select 1 from agro.talhoes t
            where t.produtor_id = (select agro.jwt_produtor())
              and (agro.slug_cultura(t.cultura) = academy_conteudos.cultura_chave
                   or agro.slug_cultura(t.cultura) like academy_conteudos.cultura_chave || '-%')
          ))
      or exists (select 1 from agro.academy_publicos p
                 where p.conteudo_id = academy_conteudos.id and p.produtor_id = (select agro.jwt_produtor()))
      or exists (select 1 from agro.academy_indicacoes i
                 where i.conteudo_id = academy_conteudos.id and i.produtor_id = (select agro.jwt_produtor()))
    )
  );

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
