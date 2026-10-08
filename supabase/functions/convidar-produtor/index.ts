// Edge Function: convidar-produtor
// O consultor abre um produtor já cadastrado e clica em "Dar acesso".
// Gera token (uuid, 7 dias), grava em agro.convites e dispara o e-mail com o
// link /produtor/aceitar?token=...  (doc §5.4)

import { cors, json } from '../_shared/cors.ts';
import { clienteServico, equipeAutorizada, identificar } from '../_shared/autorizacao.ts';
import { ehEmail, ehUuid } from '../_shared/seguranca.ts';
const appUrl = Deno.env.get('AGROTECH_APP_URL') ?? 'http://localhost:3000';
const resendKey = Deno.env.get('RESEND_API_KEY');

interface Corpo {
  produtor_id: string;
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  // valida o chamador: equipe ATIVA do escritório do produtor, com permissão de editar a carteira
  const quem = await identificar(req);
  if (!quem.ok) return quem.resposta;
  const db = clienteServico();

  const { produtor_id, email } = (await req.json().catch(() => ({}))) as Partial<Corpo>;
  if (!ehUuid(produtor_id) || !ehEmail(email)) return json({ erro: 'produtor_id ou e-mail inválido' }, 400);

  const { data: produtor } = await db
    .schema('agro').from('produtores').select('id, org_id, nome').eq('id', produtor_id).single();
  if (!produtor || !(await equipeAutorizada(quem, produtor.org_id as string, 'carteira.editar'))) {
    return json({ erro: 'produtor fora da sua carteira' }, 403);
  }

  const { data: convite, error } = await db.schema('agro').from('convites').insert({
    org_id: produtor.org_id,
    produtor_id,
    email,
  }).select('token').single();
  if (error) return json({ erro: error.message }, 500);

  const link = `${appUrl}/produtor/aceitar?token=${convite.token}`;

  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'AgroTech <no-reply@agrotech.campoforte.com.br>',
        to: email,
        subject: 'Acesso ao seu painel AgroTech',
        text: `Olá! Seu técnico liberou o acesso ao painel dos seus talhões.\n\nDefina sua senha em: ${link}\n\nO link vale por 7 dias.`,
      }),
    });
  }

  return json({ ok: true, link: resendKey ? undefined : link });
});
