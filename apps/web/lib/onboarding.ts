import { clonarPadrao } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';

/**
 * Garante que o consultor logado tenha organização e tabelas de referência.
 * Roda no guard da área do consultor: se `profiles.org_id` está null, cria a
 * organização a partir do metadata do cadastro e semeia as 5 tabelas de
 * referência com `clonarPadrao()` (uma fonte da verdade — o motor).
 *
 * Idempotente: só age quando falta a organização.
 */
export async function garantirEscritorio(): Promise<void> {
  const sb = await criarClienteServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data: perfil } = await sb
    .schema('agro').from('profiles').select('id, role, org_id, crea').eq('id', user.id).single();

  if (!perfil || perfil.org_id || perfil.role === 'produtor') return;

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const nomeEscritorio = meta.escritorio?.trim() || `Escritório de ${meta.nome ?? 'AgroTech'}`;

  const { data: org, error: eOrg } = await sb
    .schema('agro').from('orgs')
    .insert({ nome: nomeEscritorio, uf: 'ES' })
    .select('id').single();
  if (eOrg || !org) return;

  const patch: Record<string, string> = { org_id: org.id };
  if (!perfil.crea && meta.crea?.trim()) patch.crea = meta.crea.trim();
  await sb.schema('agro').from('profiles').update(patch).eq('id', user.id);

  const padrao = clonarPadrao();
  await sb.schema('agro').from('tabelas_referencia').insert([
    { org_id: org.id, tipo: 'faixas', conteudo: padrao.faixas },
    { org_id: org.id, tipo: 'fosforo', conteudo: padrao.fosforo },
    { org_id: org.id, tipo: 'culturas', conteudo: padrao.culturas },
    { org_id: org.id, tipo: 'fertilizantes', conteudo: padrao.fertilizantes },
    { org_id: org.id, tipo: 'pragas', conteudo: padrao.pragas },
  ]);

  // assinatura de teste (14 dias) — o webhook do Asaas muda o status depois
  await sb.schema('agro').from('assinaturas')
    .insert({ org_id: org.id, plano: 'teste', status: 'trial' });

  // o claim org_id só entra no token no próximo refresh; até lá jwt_org() usa o
  // fallback ao profiles. refreshSession() aqui é best-effort (Server Component
  // não grava cookie) — o login seguinte já traz o token com o claim.
  await sb.auth.refreshSession().catch(() => {});
}
