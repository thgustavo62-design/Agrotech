import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { clienteAdmin } from './supabase/admin';
import { registrarErro } from './log';

/**
 * Avisos no celular (Web Push). Quando nasce uma notificação (agro.notificacoes), o servidor manda um aviso para os aparelhos
 * da pessoa que ligaram os avisos. O despacho roda DEPOIS de cada ação do servidor (lib/acao.ts → comAviso): lê as notificações
 * recentes ainda não tratadas, "reivindica" cada uma (marca como tratada, para dois despachos simultâneos não mandarem duas vezes),
 * manda e limpa as assinaturas que o serviço de push disse que não existem mais. Sem as chaves (VAPID) configuradas, nada disso
 * roda e o resto do sistema segue igual.
 */

export interface PayloadPush { titulo: string; corpo: string; url: string; tag: string }

const SEM_CONTROLE = /[\u0000-\u001f\u007f]/g;
const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Caminho relativo e seguro para abrir ao tocar no aviso (nada de //host, \ ou esquema); qualquer outra coisa vira a página inicial. */
export function urlSegura(link: string | null | undefined): string {
  const l = (link ?? '').trim();
  if (!l.startsWith('/') || l.startsWith('//') || l.includes('\\') || /[\u0000-\u001f]/.test(l) || l.length > 300) return '/';
  return l;
}

export interface NotificacaoParaPush { id: string; tipo: string; titulo: string; corpo: string | null; link: string | null }

/** O que vai na tela de bloqueio: título curto, resumo curto, para onde levar. */
export function montarPayload(n: NotificacaoParaPush): PayloadPush {
  return {
    titulo: corta(n.titulo.replace(SEM_CONTROLE, ' ').trim() || 'AgroTech', 90),
    corpo: corta((n.corpo ?? '').replace(SEM_CONTROLE, ' ').trim(), 140),
    url: urlSegura(n.link),
    tag: `n-${n.id}`,
  };
}

export interface AssinaturaPush { endpoint: string; p256dh: string; auth: string }

/** Confere o que o navegador entrega ao assinar (https, tamanhos plausíveis, só letras de base64 url). */
export function validarAssinatura(a: { endpoint?: unknown; p256dh?: unknown; auth?: unknown }): { ok: true; assinatura: AssinaturaPush } | { ok: false; erro: string } {
  const endpoint = typeof a.endpoint === 'string' ? a.endpoint.trim() : '';
  const p256dh = typeof a.p256dh === 'string' ? a.p256dh.trim() : '';
  const auth = typeof a.auth === 'string' ? a.auth.trim() : '';
  if (!/^https:\/\/[^\s]+$/i.test(endpoint) || endpoint.length > 1000) return { ok: false, erro: 'Este navegador não entregou um endereço de aviso válido.' };
  const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
  if (!b64.test(p256dh) || p256dh.length < 20 || p256dh.length > 200) return { ok: false, erro: 'Chave de aviso inválida.' };
  if (!b64.test(auth) || auth.length < 8 || auth.length > 100) return { ok: false, erro: 'Chave de aviso inválida.' };
  return { ok: true, assinatura: { endpoint, p256dh, auth } };
}

/** Chave pública (a que o navegador usa para assinar), em base64 url: 65 bytes = 87 letras. */
export const chaveParecidaComVapid = (k: string | null | undefined): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{87}$/.test(k);

/** A chave pública do servidor, ou null se os avisos não estão configurados (a tela esconde o botão). */
export function chavePublicaDeAvisos(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY?.trim();
  return process.env.VAPID_PRIVATE_KEY && chaveParecidaComVapid(k) ? k : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// despacho (as dependências entram de fora, para testar sem rede nem banco)
// ---------------------------------------------------------------------------------------------------------------------

export interface AssinaturaSalva extends AssinaturaPush { id: string; user_id: string; falhas: number }
export type Enviador = (a: AssinaturaPush, p: PayloadPush) => Promise<{ ok: true } | { ok: false; status?: number }>;

export interface ResumoDoDespacho { vistas: number; reivindicadas: number; enviados: number; removidas: number; falhas: number }

const JANELA_MIN = 15;
const LIMITE = 50;
const FALHAS_PARA_REMOVER = 5;

export async function despacharPendentes(d: { admin: SupabaseClient; enviar: Enviador; agora?: Date; janelaMin?: number; limite?: number }): Promise<ResumoDoDespacho> {
  const agora = d.agora ?? new Date();
  const corte = new Date(agora.getTime() - (d.janelaMin ?? JANELA_MIN) * 60_000).toISOString();
  const s = d.admin.schema('agro');
  const resumo: ResumoDoDespacho = { vistas: 0, reivindicadas: 0, enviados: 0, removidas: 0, falhas: 0 };

  // o que ficou velho demais não vira aviso atrasado: só é dado como tratado
  await s.from('notificacoes').update({ push_enviado_em: agora.toISOString() }).is('push_enviado_em', null).lt('criado_em', corte);

  const { data: pendentes } = await s.from('notificacoes')
    .select('id, tipo, titulo, corpo, link, destinatario_user_id')
    .is('push_enviado_em', null).gte('criado_em', corte).order('criado_em').limit(d.limite ?? LIMITE);
  const lista = (pendentes ?? []) as Array<NotificacaoParaPush & { destinatario_user_id: string }>;
  resumo.vistas = lista.length;
  if (lista.length === 0) return resumo;

  // reivindica: só quem conseguir marcar manda (dois despachos ao mesmo tempo não repetem o aviso)
  const { data: minhas } = await s.from('notificacoes').update({ push_enviado_em: agora.toISOString() })
    .in('id', lista.map((n) => n.id)).is('push_enviado_em', null).select('id');
  const meus = new Set(((minhas ?? []) as Array<{ id: string }>).map((m) => m.id));
  const aMandar = lista.filter((n) => meus.has(n.id));
  resumo.reivindicadas = aMandar.length;
  if (aMandar.length === 0) return resumo;

  const { data: assin } = await s.from('push_assinaturas').select('id, user_id, endpoint, p256dh, auth, falhas').in('user_id', [...new Set(aMandar.map((n) => n.destinatario_user_id))]);
  const porPessoa = new Map<string, AssinaturaSalva[]>();
  for (const a of (assin ?? []) as AssinaturaSalva[]) porPessoa.set(a.user_id, [...(porPessoa.get(a.user_id) ?? []), a]);

  for (const n of aMandar) {
    const payload = montarPayload(n);
    for (const a of porPessoa.get(n.destinatario_user_id) ?? []) {
      const r = await d.enviar({ endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth }, payload);
      if (r.ok) {
        resumo.enviados++;
        await s.from('push_assinaturas').update({ falhas: 0, ultimo_envio_em: agora.toISOString() }).eq('id', a.id);
      } else if (r.status === 404 || r.status === 410) {
        // o aparelho desinstalou ou revogou: a assinatura morreu
        resumo.removidas++;
        await s.from('push_assinaturas').delete().eq('id', a.id);
      } else {
        resumo.falhas++;
        if (a.falhas + 1 >= FALHAS_PARA_REMOVER) { resumo.removidas++; await s.from('push_assinaturas').delete().eq('id', a.id); }
        else await s.from('push_assinaturas').update({ falhas: a.falhas + 1 }).eq('id', a.id);
      }
    }
  }
  return resumo;
}

/** O enviador de verdade (biblioteca web-push). null se as chaves não estão configuradas. */
export function criarEnviadorWebPush(): Enviador | null {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  const assunto = process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@agrotech.local';
  if (!chaveParecidaComVapid(publica) || !privada) return null;
  webpush.setVapidDetails(assunto, publica, privada);
  return async (a, p) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(p), { TTL: 6 * 3600, urgency: 'normal' });
      return { ok: true };
    } catch (e) {
      const status = typeof e === 'object' && e !== null && 'statusCode' in e ? Number((e as { statusCode: unknown }).statusCode) : undefined;
      return { ok: false, status };
    }
  };
}

/** Chamado depois das ações do servidor: manda os avisos que nasceram. Nunca lança (aviso que falha não pode derrubar a ação). */
export async function despacharPush(): Promise<void> {
  try {
    const enviar = criarEnviadorWebPush();
    const admin = clienteAdmin();
    if (!enviar || !admin) return;
    await despacharPendentes({ admin, enviar });
  } catch (e) {
    registrarErro('push.despacho', e);
  }
}
