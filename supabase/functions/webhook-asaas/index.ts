// Edge Function: webhook-asaas
// Recebe eventos de cobrança do Asaas. Ver docs/PRODUTO-VENDAVEL.md §4.
//
// Três cuidados:
//   1. autenticidade — confere o header asaas-access-token
//   2. idempotência   — upsert em cobrancas.gateway_id (unique)
//   3. responde 200 só DEPOIS de gravar

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenEsperado = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '';

interface Pagamento {
  id: string;
  customer?: string;
  subscription?: string;
  value?: number;
  status?: string;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string;
}
interface Evento {
  event: string;
  payment?: Pagamento;
}

const ATIVA = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const SUSPENDE = new Set(['PAYMENT_OVERDUE']);
const CANCELA = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método', { status: 405 });

  // 1. autenticidade
  if (!tokenEsperado || req.headers.get('asaas-access-token') !== tokenEsperado) {
    return new Response('não autorizado', { status: 401 });
  }

  const corpo = (await req.json()) as Evento;
  const pg = corpo.payment;
  if (!pg?.id) return new Response('sem pagamento', { status: 400 });

  const db = createClient(supabaseUrl, serviceRole);

  // acha a assinatura pelo customer ou subscription do gateway
  const { data: ass } = await db
    .schema('agro')
    .from('assinaturas')
    .select('id, org_id, plano, status')
    .or([
      pg.customer ? `gateway_customer_id.eq.${pg.customer}` : '',
      pg.subscription ? `gateway_subscription_id.eq.${pg.subscription}` : '',
    ].filter(Boolean).join(','))
    .maybeSingle();

  if (!ass) {
    // grava a cobrança mesmo sem assinatura casada, para reconciliar depois
    await db.schema('agro').from('cobrancas').upsert(
      { org_id: null, gateway_id: pg.id, valor: pg.value, status: pg.status, metodo: pg.billingType, vencimento: pg.dueDate },
      { onConflict: 'gateway_id' },
    );
    return new Response('ok (sem assinatura casada)', { status: 200 });
  }

  // 2. idempotência
  await db.schema('agro').from('cobrancas').upsert(
    {
      org_id: ass.org_id,
      assinatura_id: ass.id,
      gateway_id: pg.id,
      valor: pg.value,
      status: pg.status,
      metodo: pg.billingType,
      vencimento: pg.dueDate ?? null,
      pago_em: pg.paymentDate ? new Date(pg.paymentDate).toISOString() : null,
    },
    { onConflict: 'gateway_id' },
  );

  // efeito na assinatura
  let novoStatus: string | null = null;
  if (ATIVA.has(corpo.event)) novoStatus = 'ativa';
  else if (SUSPENDE.has(corpo.event)) novoStatus = 'suspensa';
  else if (CANCELA.has(corpo.event)) novoStatus = 'cancelada';

  if (novoStatus) {
    const patch: Record<string, unknown> = { status: novoStatus };
    if (novoStatus === 'ativa' && pg.dueDate) {
      const d = new Date(pg.dueDate);
      d.setMonth(d.getMonth() + 1);
      patch.atual_ate = d.toISOString().slice(0, 10);
    }
    await db.schema('agro').from('assinaturas').update(patch).eq('id', ass.id);
  }

  // 3. só agora responde
  return new Response('ok', { status: 200 });
});
