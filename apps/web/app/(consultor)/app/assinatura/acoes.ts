'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { comAviso, ErroDeUsuario } from '@/lib/acao';

/**
 * Gera um link de checkout recorrente no Asaas e redireciona pra lá — o
 * consultor escolhe PIX/boleto/cartão na página hospedada do Asaas, e o
 * webhook-asaas (já existente, supabase/functions/webhook-asaas) recebe a
 * confirmação e ativa a assinatura.
 *
 * NUNCA testado contra uma conta Asaas real — este ambiente não tem
 * credencial. Só roda de fato quando ASAAS_API_KEY estiver configurado (ver
 * .env.example); sem a chave, falha com uma mensagem clara em vez de fingir
 * que funciona (mesmo padrão de degradação do RESEND_API_KEY opcional em
 * convidarProdutor).
 */
async function iniciarUpgradeImpl(fd: FormData) {
  const planoId = String(fd.get('plano_id') ?? '');
  if (!planoId) throw new ErroDeUsuario('Plano não informado.');

  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new ErroDeUsuario('Checkout automático ainda não está configurado neste ambiente. Fale com o suporte da Nova7 pra mudar de plano.');
  }

  const perfil = await exigir('plano.gerenciar');

  const sb = await criarClienteServidor();
  const [{ data: org }, { data: plano }] = await Promise.all([
    sb.schema('agro').from('orgs').select('nome').eq('id', perfil.org_id).single(),
    sb.schema('agro').from('planos').select('nome, preco_mes').eq('id', planoId).single(),
  ]);
  if (!plano) throw new ErroDeUsuario('Plano inválido.');

  const resp = await fetch('https://api.asaas.com/v3/paymentLinks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', access_token: apiKey },
    body: JSON.stringify({
      name: `AgroTech — ${plano.nome}${org?.nome ? ` (${org.nome})` : ''}`,
      billingType: 'UNDEFINED',
      chargeType: 'RECURRENT',
      subscriptionCycle: 'MONTHLY',
      value: Number(plano.preco_mes),
      dueDateLimitDays: 5,
    }),
  });

  if (!resp.ok) {
    throw new ErroDeUsuario('Não deu pra gerar o link de pagamento agora. Tente de novo em instantes.');
  }
  const dados = (await resp.json()) as { url?: string };
  if (!dados.url) throw new ErroDeUsuario('O Asaas não devolveu o link de pagamento.');

  // só segue para o domínio do Asaas por HTTPS (defesa em profundidade: o link vem de uma API externa)
  let destino: URL;
  try {
    destino = new URL(dados.url);
  } catch {
    throw new ErroDeUsuario('O Asaas devolveu um link inválido.');
  }
  if (destino.protocol !== 'https:' || !/(^|\.)asaas\.com$/.test(destino.hostname)) {
    throw new ErroDeUsuario('O Asaas devolveu um link fora do domínio esperado.');
  }
  redirect(destino.toString());
}

export const iniciarUpgrade = comAviso(iniciarUpgradeImpl);
