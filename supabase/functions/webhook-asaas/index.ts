// Edge Function: webhook-asaas
// Recebe eventos de cobrança do Asaas. Ver docs/PRODUTO-VENDAVEL.md §4 e docs/PROGRESSO.md (AG-010).
//
// Cuidados:
//   1. autenticidade — confere o header asaas-access-token (em tempo constante; sem token configurado nada passa)
//   2. casamento     — o pagamento só mexe num escritório PROVADO: pela assinatura já vinculada ou pelo link de checkout
//                      que o AgroTech gerou (agro.checkouts); o resto vai para quarentena (agro.cobrancas_orfas)
//   3. idempotência  — upsert em cobrancas.gateway_id (unique): o mesmo evento duas vezes não duplica nada
//   4. regras        — _shared/cobranca.ts: valor tem que bater com o plano, plano vem do checkout, cancelada não reativa
//   5. responde 200 só DEPOIS de gravar TUDO; qualquer falha de gravação devolve 500 para o Asaas reenviar
//
// NUNCA testado contra o Asaas real (sem conta sandbox). Antes de ativar cobrança: rodar um ciclo completo no sandbox.

import { createClient } from '@supabase/supabase-js';
import { decidir, type AssinaturaLocal, type CheckoutLocal, type EventoAsaas, type Via } from '../_shared/cobranca.ts';
import { iguaisEmTempoConstante } from '../_shared/seguranca.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenEsperado = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '';

const resposta = (corpo: string, status: number) => new Response(corpo, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return resposta('método', 405);

  // 1. autenticidade
  if (tokenEsperado.length < 16 || !iguaisEmTempoConstante(req.headers.get('asaas-access-token') ?? '', tokenEsperado)) {
    return resposta('não autorizado', 401);
  }

  const ev = (await req.json().catch(() => null)) as EventoAsaas | null;
  const pg = ev?.payment;
  if (!ev || !pg?.id) return resposta('sem pagamento', 400);

  const db = createClient(supabaseUrl, serviceRole);
  const agro = db.schema('agro');

  const quarentena = async (motivo: string) => {
    const { error } = await agro.from('cobrancas_orfas').insert({ gateway_id: pg.id, evento: ev.event, motivo, payload: ev });
    if (error) {
      console.error('[webhook-asaas] quarentena', error);
      return resposta('falha ao registrar', 500); // o Asaas reenvia
    }
    return resposta(`ok (em quarentena: ${motivo})`, 200);
  };

  // 2. a quem pertence? primeiro pelo que já está vinculado; senão pelo link de checkout do AgroTech
  let via: Via | null = null;
  let orgId: string | null = null;
  let checkout: CheckoutLocal | null = null;

  const filtros = [
    pg.subscription ? `gateway_subscription_id.eq.${pg.subscription}` : '',
    pg.customer ? `gateway_customer_id.eq.${pg.customer}` : '',
  ].filter(Boolean);
  if (filtros.length) {
    const { data, error } = await agro.from('assinaturas').select('org_id').or(filtros.join(',')).limit(2);
    if (error) { console.error('[webhook-asaas] assinatura', error); return resposta('falha', 500); }
    if ((data ?? []).length > 1) return quarentena('mais de um escritório com o mesmo cliente/assinatura do Asaas');
    if (data?.[0]) { via = 'assinatura'; orgId = data[0].org_id as string; }
  }
  if (!orgId && pg.paymentLink) {
    const { data, error } = await agro.from('checkouts')
      .select('id, org_id, plano_id, gateway_link_id, valor_esperado').eq('gateway_link_id', pg.paymentLink).maybeSingle();
    if (error) { console.error('[webhook-asaas] checkout', error); return resposta('falha', 500); }
    if (data) {
      via = 'checkout';
      orgId = data.org_id as string;
      checkout = { ...data, valor_esperado: Number(data.valor_esperado) } as CheckoutLocal;
    }
  }
  if (!orgId || !via) return quarentena('pagamento sem escritório identificado (sem assinatura nem checkout correspondente)');

  const { data: ass, error: eAss } = await agro.from('assinaturas')
    .select('id, org_id, plano, status, gateway_customer_id, gateway_subscription_id').eq('org_id', orgId).maybeSingle();
  if (eAss) { console.error('[webhook-asaas] assinatura do escritório', eAss); return resposta('falha', 500); }

  // 4. regras
  const decisao = decidir(ev, { via, assinatura: (ass as AssinaturaLocal | null), checkout });
  if (decisao.tipo === 'orfao') return quarentena(decisao.motivo);

  // 3. a cobrança em si (idempotente por gateway_id)
  const { error: eCob } = await agro.from('cobrancas').upsert(
    {
      org_id: orgId,
      assinatura_id: ass!.id,
      gateway_id: pg.id,
      valor: pg.value,
      status: pg.status,
      metodo: pg.billingType,
      vencimento: pg.dueDate ?? null,
      pago_em: pg.paymentDate ? new Date(pg.paymentDate).toISOString() : null,
    },
    { onConflict: 'gateway_id' },
  );
  if (eCob) { console.error('[webhook-asaas] cobrança', eCob); return resposta('falha ao gravar a cobrança', 500); }

  // efeito na assinatura
  if (decisao.tipo === 'aplicar') {
    const { error: eUp } = await agro.from('assinaturas').update(decisao.patch).eq('id', ass!.id);
    if (eUp) { console.error('[webhook-asaas] assinatura', eUp); return resposta('falha ao atualizar a assinatura', 500); }
    if (decisao.checkoutUsado) {
      const { error: eCk } = await agro.from('checkouts').update({ usado_em: new Date().toISOString() }).eq('id', decisao.checkoutUsado).is('usado_em', null);
      if (eCk) { console.error('[webhook-asaas] checkout usado', eCk); return resposta('falha ao fechar o checkout', 500); }
    }
  }

  // 5. só agora responde
  return resposta('ok', 200);
});
