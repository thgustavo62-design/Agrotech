'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

/** Cria um link público de resultados para o produtor (cultura opcional). */
export async function criarCompartilhamento(fd: FormData) {
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const culturaRaw = String(fd.get('cultura') ?? '').trim();
  const cultura = culturaRaw === '' || culturaRaw === '__todas' ? null : culturaRaw;
  const rotulo = String(fd.get('rotulo') ?? '').trim() || null;
  if (!produtor_id) throw new Error('produtor não informado');

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('sessão inválida');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('compartilhamentos').insert({
    org_id: perfil.org_id,
    produtor_id,
    cultura,
    rotulo,
  }).select('id, token').single();
  if (error) throw new Error(error.message);
  await registrar(sb, {
    acao: 'compartilhamento.criado',
    entidade: 'compartilhamentos',
    entidade_id: data?.id ?? null,
    org_id: perfil.org_id,
    dados: { produtor_id, cultura, rotulo },
  });
  revalidatePath(`/app/produtores/${produtor_id}`);
}

/** Convida o produtor a acessar o portal (login próprio). */
export async function convidarProdutor(fd: FormData) {
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!produtor_id || !email) throw new Error('produtor e e-mail são obrigatórios');

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('sessão inválida');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('convites').insert({
    org_id: perfil.org_id,
    produtor_id,
    email,
  }).select('token').single();
  if (error) throw new Error(error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const link = `${appUrl}/produtor/aceitar?token=${data.token}`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'AgroTech <no-reply@agrotech.campoforte.com.br>',
        to: email,
        subject: 'Acesso ao seu painel AgroTech',
        text: `Seu técnico liberou o acesso ao painel dos seus talhões.\n\nDefina sua senha em: ${link}\n\nO link vale por 7 dias.`,
      }),
    }).catch(() => {});
  }

  await registrar(sb, {
    acao: 'produtor.convidado',
    entidade: 'produtores',
    entidade_id: produtor_id,
    org_id: perfil.org_id,
    dados: { email, enviado: Boolean(resendKey) },
  });
  revalidatePath(`/app/produtores/${produtor_id}`);
}

/** Exclusão sob solicitação (LGPD). Apaga o produtor e tudo abaixo dele.
 *  Laudo é documento técnico — a retenção padrão é por exclusão lógica; esta é a
 *  via para o pedido de eliminação do titular, que prevalece sobre a retenção. */
export async function excluirProdutor(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const confirmar = String(fd.get('confirmar') ?? '');
  if (!id) throw new Error('produtor não informado');
  if (confirmar !== 'EXCLUIR') throw new Error('digite EXCLUIR para confirmar');

  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();
  await registrar(sb, {
    acao: 'produtor.excluido_lgpd',
    entidade: 'produtores',
    entidade_id: id,
    org_id: perfil?.org_id ?? null,
  });

  const { error } = await sb.schema('agro').from('produtores').delete().eq('id', id);
  if (error) throw new Error(error.message);
  redirect('/app/produtores');
}

export async function alternarCompartilhamento(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const ativo = String(fd.get('ativo') ?? '') === 'true';
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('compartilhamentos').update({ ativo: !ativo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/produtores/${produtor_id}`);
}
