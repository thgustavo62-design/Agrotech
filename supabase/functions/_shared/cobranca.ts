// Regras do webhook do Asaas, SEM dependência de Deno — testáveis em Node (packages/db-test/test/cobranca.test.ts).
// O webhook (webhook-asaas/index.ts) busca os dados, chama `decidir` e só então grava; aqui mora o "o que fazer".
//
// Princípios (AG-010):
//   - um pagamento só mexe numa assinatura quando é possível PROVAR a qual escritório ele pertence: pela assinatura/
//     cliente já vinculados, ou pelo link de checkout que o próprio AgroTech gerou para aquele escritório;
//   - o plano contratado vem do checkout (o webhook antes só mudava o status e o plano ficava "teste" para sempre);
//   - valor diferente do preço do plano NÃO ativa nada;
//   - assinatura cancelada não é reativada por pagamento de ciclo antigo (só por um checkout novo);
//   - o que não casa vai para quarentena (cobrancas_orfas) em vez de ser descartado ou de "adivinhar" o escritório.

export interface Pagamento {
  id: string;
  customer?: string;
  subscription?: string;
  paymentLink?: string;
  value?: number;
  status?: string;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string;
}

export interface EventoAsaas { event: string; payment?: Pagamento }

export interface AssinaturaLocal {
  id: string;
  org_id: string;
  plano: string;
  status: 'trial' | 'ativa' | 'suspensa' | 'cancelada';
  gateway_customer_id: string | null;
  gateway_subscription_id: string | null;
}

export interface CheckoutLocal {
  id: string;
  org_id: string;
  plano_id: string;
  gateway_link_id: string;
  valor_esperado: number;
}

export const ATIVA = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
export const SUSPENDE = new Set(['PAYMENT_OVERDUE']);
export const CANCELA = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED']);

export type Via = 'assinatura' | 'checkout';

export type Decisao =
  | { tipo: 'orfao'; motivo: string }
  | { tipo: 'registrar'; motivo?: string }
  | { tipo: 'aplicar'; patch: PatchAssinatura; checkoutUsado?: string };

export interface PatchAssinatura {
  status: AssinaturaLocal['status'];
  plano?: string;
  gateway_customer_id?: string;
  gateway_subscription_id?: string;
  atual_ate?: string;
}

/** "2026-01-31" + 1 mês = "2026-02-28" (não "2026-03-03"). */
export function maisUmMes(dataIso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const alvoAno = mes === 12 ? ano + 1 : ano;
  const alvoMes = mes === 12 ? 1 : mes + 1;
  const ultimo = new Date(Date.UTC(alvoAno, alvoMes, 0)).getUTCDate();
  return `${alvoAno}-${String(alvoMes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

const mesmoValor = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * @param via como o escritório foi identificado; `assinatura` é a do escritório (pode não existir ainda)
 */
export function decidir(
  ev: EventoAsaas,
  ctx: { via: Via; assinatura: AssinaturaLocal | null; checkout: CheckoutLocal | null },
): Decisao {
  const pg = ev.payment;
  if (!pg?.id) return { tipo: 'orfao', motivo: 'evento sem pagamento' };
  const { via, assinatura, checkout } = ctx;
  if (!assinatura) return { tipo: 'orfao', motivo: 'escritório sem assinatura cadastrada' };

  const ativa = ATIVA.has(ev.event);
  const suspende = SUSPENDE.has(ev.event);
  const cancela = CANCELA.has(ev.event);
  if (!ativa && !suspende && !cancela) return { tipo: 'registrar', motivo: `evento ${ev.event} só registrado` };

  if (ativa) {
    if (via === 'checkout') {
      if (!checkout) return { tipo: 'orfao', motivo: 'casou pelo link mas o checkout não foi informado' };
      if (typeof pg.value !== 'number' || !mesmoValor(pg.value, checkout.valor_esperado)) {
        return { tipo: 'orfao', motivo: `valor ${pg.value ?? '?'} diferente do preço do plano (${checkout.valor_esperado})` };
      }
    } else if (assinatura.status === 'cancelada') {
      // pagamento de uma cobrança antiga de uma assinatura já cancelada: registra, não reativa
      return { tipo: 'registrar', motivo: 'assinatura cancelada: só um novo checkout a reativa' };
    }
    const patch: PatchAssinatura = { status: 'ativa' };
    if (via === 'checkout' && checkout) patch.plano = checkout.plano_id;
    if (pg.customer) patch.gateway_customer_id = pg.customer;
    if (pg.subscription) patch.gateway_subscription_id = pg.subscription;
    const ate = pg.dueDate ? maisUmMes(pg.dueDate) : null;
    if (ate) patch.atual_ate = ate;
    return { tipo: 'aplicar', patch, checkoutUsado: via === 'checkout' ? checkout?.id : undefined };
  }

  if (assinatura.status === 'cancelada') return { tipo: 'registrar', motivo: 'assinatura já cancelada' };
  if (suspende) return { tipo: 'aplicar', patch: { status: 'suspensa' } };
  return { tipo: 'aplicar', patch: { status: 'cancelada' } };
}
