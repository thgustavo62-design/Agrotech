-- 0053 — Academy: conferir um certificado pelo código, sem login
--
-- Quem recebe um certificado de participação (o produtor, um banco, uma cooperativa) precisa poder conferir se ele é verdadeiro.
-- A função devolve só o que está impresso no certificado — nome, curso, escritório, data, carga — e nada além (nem CREA, nem
-- ids, nem e-mail). Sem código certo não devolve nada. O código (AT-XXXXX-XXXXX, 10 símbolos hexadecimais) é o segredo
-- compartilhado por quem mostra o certificado; chutar um código existente é impraticável (cerca de 10^12 possibilidades).
--
-- É a QUARTA função liberada ao público (anon), depois das três de 0034: o teste de segurança (seguranca.test.ts) lista todas.

create or replace function agro.certificado_publico(p_codigo text)
returns table (aluno_nome text, titulo_curso text, escritorio_nome text, emitido_em timestamptz, carga_min int, aulas int, responsavel_nome text)
language sql
stable
security definer
set search_path = agro, public
as $$
  select c.aluno_nome, c.titulo_curso, c.escritorio_nome, c.emitido_em, c.carga_min, c.aulas, c.responsavel_nome
  from agro.academy_certificados c
  where upper(btrim(p_codigo)) ~ '^AT-[0-9A-F]{5}-[0-9A-F]{5}$'
    and c.codigo = upper(btrim(p_codigo))
$$;

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044, e esta é liberada de propósito
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on function agro.certificado_publico(text) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- ajudantes internos: só por gatilho
revoke execute on function agro.academy_sincronizar_curso(uuid, uuid) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_equipe(uuid, uuid, text, text, text, text) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_produtor(uuid, uuid, text, text, text, text) from authenticated, service_role;
