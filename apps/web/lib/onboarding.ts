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

  // o escritório nasce no servidor (migration 0037): o cliente não pode mais gravar org_id no próprio
  // perfil, e quem cria vira proprietário na mesma transação.
  const { data: orgId, error: eOrg } = await sb
    .schema('agro').rpc('criar_escritorio', { p_nome: nomeEscritorio, p_municipio: null, p_uf: 'ES' });
  if (eOrg || !orgId) return;
  const org = { id: orgId as string };

  if (!perfil.crea && meta.crea?.trim()) {
    await sb.schema('agro').from('profiles').update({ crea: meta.crea.trim() }).eq('id', user.id);
  }

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
