'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

const CAMINHO = '/app/equipe';

async function exigirConsultor() {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem escritório associado.');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') throw new Error('Sem permissão.');
  return perfil;
}

/** Convida alguém pra entrar no mesmo escritório — mesmo acesso de hoje (ver 0030). */
export async function convidarEquipe(fd: FormData) {
  const perfil = await exigirConsultor();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const titulo = String(fd.get('titulo') ?? '').trim() || null;
  if (!email) throw new Error('Informe o e-mail.');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('convites_equipe').insert({
    org_id: perfil.org_id,
    email,
    titulo,
    criado_por: perfil.id,
  }).select('token').single();
  if (error) throw new Error(error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const link = `${appUrl}/equipe/aceitar?token=${data.token}`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'AgroTech <no-reply@agrotech.campoforte.com.br>',
        to: email,
        subject: 'Convite para o escritório no AgroTech',
        text: `Você foi convidado a entrar no escritório "${perfil.nome ?? ''}" no AgroTech.\n\nDefina sua senha em: ${link}\n\nO link vale por 7 dias.`,
      }),
    }).catch(() => {});
  }

  await registrar(sb, {
    acao: 'equipe.convidado', entidade: 'convites_equipe', entidade_id: data.token, org_id: perfil.org_id,
    dados: { email, titulo, enviado: Boolean(resendKey) },
  });
  revalidatePath(CAMINHO);
}

export async function cancelarConviteEquipe(fd: FormData) {
  const perfil = await exigirConsultor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Convite não informado.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('convites_equipe').delete().eq('id', id).eq('org_id', perfil.org_id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

/** Remove um colega do escritório (zera org_id — no próximo login ele ganha um escritório novo e vazio). */
export async function removerDaEquipe(fd: FormData) {
  const perfil = await exigirConsultor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Integrante não informado.');
  if (id === perfil.id) throw new Error('Você não pode se remover da própria equipe por aqui.');

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('profiles').update({ org_id: null, titulo: null }).eq('id', id).eq('org_id', perfil.org_id);
  if (error) throw new Error(error.message);

  await registrar(sb, {
    acao: 'equipe.removido', entidade: 'profiles', entidade_id: id, org_id: perfil.org_id,
  });
  revalidatePath(CAMINHO);
}
