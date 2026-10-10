'use server';

import { perfilAtual } from '@/lib/supabase/server';
import { clienteAdmin } from '@/lib/supabase/admin';
import { chavePublicaDeAvisos, criarEnviadorWebPush, validarAssinatura } from '@/lib/push';

/**
 * Ligar, desligar e testar os avisos no celular. Devolvem um resultado em vez de lançar erro: quem chama é o botão da tela
 * (components/ativar-avisos.tsx), que mostra a mensagem ao lado dele.
 */
export type ResultadoAviso = { ok: true } | { ok: false; erro: string };

/** Guarda a assinatura deste aparelho para a pessoa logada (a chave de serviço grava; aqui se confere quem é e o que veio). */
export async function ativarAvisos(entrada: { endpoint: unknown; p256dh: unknown; auth: unknown; agente?: unknown }): Promise<ResultadoAviso> {
  if (!chavePublicaDeAvisos()) return { ok: false, erro: 'Os avisos no celular ainda não foram configurados neste sistema.' };
  const perfil = await perfilAtual();
  if (!perfil) return { ok: false, erro: 'Entre na sua conta para ligar os avisos.' };
  const v = validarAssinatura(entrada);
  if (!v.ok) return v;
  const admin = clienteAdmin();
  if (!admin) return { ok: false, erro: 'Não foi possível guardar o aviso agora. Tente de novo em instantes.' };

  // o mesmo aparelho pode trocar de pessoa (outro login): a assinatura passa a ser de quem está logado agora
  const { error } = await admin.schema('agro').from('push_assinaturas').upsert({
    user_id: perfil.id,
    org_id: perfil.org_id,
    endpoint: v.assinatura.endpoint,
    p256dh: v.assinatura.p256dh,
    auth: v.assinatura.auth,
    user_agent: typeof entrada.agente === 'string' ? entrada.agente.slice(0, 300) : null,
    falhas: 0,
  }, { onConflict: 'endpoint' });
  if (error) return { ok: false, erro: 'Não foi possível guardar o aviso agora. Tente de novo em instantes.' };
  return { ok: true };
}

/** Desliga os avisos deste aparelho (só apaga a assinatura da própria pessoa). */
export async function desativarAvisos(endpoint: unknown): Promise<ResultadoAviso> {
  const perfil = await perfilAtual();
  if (!perfil) return { ok: false, erro: 'Entre na sua conta.' };
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return { ok: false, erro: 'Aparelho inválido.' };
  const admin = clienteAdmin();
  if (!admin) return { ok: false, erro: 'Não foi possível desligar agora. Tente de novo em instantes.' };
  await admin.schema('agro').from('push_assinaturas').delete().eq('endpoint', endpoint).eq('user_id', perfil.id);
  return { ok: true };
}

/** Manda um aviso de teste para os aparelhos da própria pessoa ("os avisos estão funcionando?"). */
export async function enviarAvisoDeTeste(): Promise<ResultadoAviso> {
  const enviar = criarEnviadorWebPush();
  if (!enviar) return { ok: false, erro: 'Os avisos no celular ainda não foram configurados neste sistema.' };
  const perfil = await perfilAtual();
  if (!perfil) return { ok: false, erro: 'Entre na sua conta.' };
  const admin = clienteAdmin();
  if (!admin) return { ok: false, erro: 'Não foi possível enviar agora.' };
  const { data } = await admin.schema('agro').from('push_assinaturas').select('endpoint, p256dh, auth').eq('user_id', perfil.id);
  const aparelhos = (data ?? []) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  if (aparelhos.length === 0) return { ok: false, erro: 'Nenhum aparelho com os avisos ligados. Ligue primeiro.' };
  let enviados = 0;
  for (const a of aparelhos) {
    const r = await enviar(a, { titulo: 'Avisos ligados ✔', corpo: 'Você vai receber aqui o que o AgroTech tiver para você.', url: '/', tag: 'teste' });
    if (r.ok) enviados++;
    else if (r.status === 404 || r.status === 410) await admin.schema('agro').from('push_assinaturas').delete().eq('endpoint', a.endpoint).eq('user_id', perfil.id);
  }
  return enviados > 0 ? { ok: true } : { ok: false, erro: 'Não foi possível entregar o aviso de teste. Desligue e ligue de novo.' };
}
