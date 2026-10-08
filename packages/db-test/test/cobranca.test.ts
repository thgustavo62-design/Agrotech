import { describe, expect, it } from 'vitest';
import { decidir, maisUmMes, type AssinaturaLocal, type CheckoutLocal, type EventoAsaas } from '../../../supabase/functions/_shared/cobranca';

const ass = (extra: Partial<AssinaturaLocal> = {}): AssinaturaLocal => ({
  id: 'a1', org_id: 'o1', plano: 'teste', status: 'trial', gateway_customer_id: null, gateway_subscription_id: null, ...extra,
});
const ck: CheckoutLocal = { id: 'c1', org_id: 'o1', plano_id: 'tecnico', gateway_link_id: 'link1', valor_esperado: 149 };
const pago = (extra: Partial<NonNullable<EventoAsaas['payment']>> = {}): EventoAsaas => ({
  event: 'PAYMENT_RECEIVED',
  payment: { id: 'pay1', customer: 'cus1', subscription: 'sub1', paymentLink: 'link1', value: 149, dueDate: '2026-10-31', ...extra },
});

describe('decidir — primeiro pagamento, casado pelo checkout do AgroTech', () => {
  it('ativa, TROCA O PLANO pelo contratado e vincula cliente/assinatura do gateway', () => {
    const d = decidir(pago(), { via: 'checkout', assinatura: ass(), checkout: ck });
    expect(d).toEqual({
      tipo: 'aplicar',
      patch: { status: 'ativa', plano: 'tecnico', gateway_customer_id: 'cus1', gateway_subscription_id: 'sub1', atual_ate: '2026-11-30' },
      checkoutUsado: 'c1',
    });
  });

  it('valor diferente do preço do plano NÃO ativa: vai para a quarentena', () => {
    const d = decidir(pago({ value: 1 }), { via: 'checkout', assinatura: ass(), checkout: ck });
    expect(d).toMatchObject({ tipo: 'orfao' });
    expect((d as { motivo: string }).motivo).toMatch(/diferente do preço/);
  });

  it('sem valor informado também não ativa', () => {
    expect(decidir(pago({ value: undefined }), { via: 'checkout', assinatura: ass(), checkout: ck })).toMatchObject({ tipo: 'orfao' });
  });

  it('reativa uma assinatura cancelada quando vem de um checkout NOVO', () => {
    const d = decidir(pago(), { via: 'checkout', assinatura: ass({ status: 'cancelada' }), checkout: ck });
    expect(d).toMatchObject({ tipo: 'aplicar', patch: { status: 'ativa', plano: 'tecnico' } });
  });
});

describe('decidir — cobranças seguintes, casadas pela assinatura já vinculada', () => {
  const vinculada = (extra: Partial<AssinaturaLocal> = {}) => ass({ plano: 'tecnico', status: 'ativa', gateway_customer_id: 'cus1', gateway_subscription_id: 'sub1', ...extra });

  it('renova a validade sem mexer no plano', () => {
    const d = decidir(pago({ paymentLink: undefined, dueDate: '2026-11-30' }), { via: 'assinatura', assinatura: vinculada(), checkout: null });
    expect(d).toMatchObject({ tipo: 'aplicar', patch: { status: 'ativa', atual_ate: '2026-12-30' } });
    expect((d as { patch: object }).patch).not.toHaveProperty('plano');
  });

  it('cobrança vencida suspende; reembolso e exclusão cancelam', () => {
    expect(decidir({ event: 'PAYMENT_OVERDUE', payment: { id: 'p' } }, { via: 'assinatura', assinatura: vinculada(), checkout: null })).toEqual({ tipo: 'aplicar', patch: { status: 'suspensa' } });
    for (const event of ['PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED']) {
      expect(decidir({ event, payment: { id: 'p' } }, { via: 'assinatura', assinatura: vinculada(), checkout: null })).toEqual({ tipo: 'aplicar', patch: { status: 'cancelada' } });
    }
  });

  it('pagamento antigo NÃO reativa assinatura cancelada (evento fora de ordem)', () => {
    const d = decidir(pago({ paymentLink: undefined }), { via: 'assinatura', assinatura: vinculada({ status: 'cancelada' }), checkout: null });
    expect(d).toMatchObject({ tipo: 'registrar' });
  });

  it('vencida ou reembolsada depois de cancelada não muda nada', () => {
    for (const event of ['PAYMENT_OVERDUE', 'PAYMENT_REFUNDED']) {
      expect(decidir({ event, payment: { id: 'p' } }, { via: 'assinatura', assinatura: vinculada({ status: 'cancelada' }), checkout: null })).toMatchObject({ tipo: 'registrar' });
    }
  });

  it('o mesmo evento duas vezes dá a mesma decisão (idempotente)', () => {
    const entrada = { via: 'assinatura' as const, assinatura: vinculada(), checkout: null };
    expect(decidir(pago({ paymentLink: undefined }), entrada)).toEqual(decidir(pago({ paymentLink: undefined }), entrada));
  });
});

describe('decidir — o que não dá para provar', () => {
  it('evento sem pagamento ou escritório sem assinatura → quarentena', () => {
    expect(decidir({ event: 'PAYMENT_RECEIVED' }, { via: 'assinatura', assinatura: ass(), checkout: null })).toMatchObject({ tipo: 'orfao' });
    expect(decidir(pago(), { via: 'checkout', assinatura: null, checkout: ck })).toMatchObject({ tipo: 'orfao' });
  });
  it('evento desconhecido só é registrado', () => {
    expect(decidir({ event: 'PAYMENT_CREATED', payment: { id: 'p' } }, { via: 'assinatura', assinatura: ass(), checkout: null })).toMatchObject({ tipo: 'registrar' });
  });
});

describe('maisUmMes', () => {
  it('respeita o fim do mês e a virada do ano', () => {
    expect(maisUmMes('2026-01-31')).toBe('2026-02-28');
    expect(maisUmMes('2028-01-31')).toBe('2028-02-29');
    expect(maisUmMes('2026-12-15')).toBe('2027-01-15');
    expect(maisUmMes('lixo')).toBeNull();
  });
});
