'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { perfisOuPadrao } from '@/lib/permissoes';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { enderecoDoSite } from './dados';

const CAMINHO = '/app/config/equipe';
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Convida alguém para o escritório já com os perfis escolhidos (migration 0037). Só quem gerencia a equipe. */
async function convidarEquipeImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const titulo = String(fd.get('titulo') ?? '').trim().slice(0, 60) || null;
  if (!RE_EMAIL.test(email)) throw new ErroDeUsuario('Informe um e-mail válido.');
  const perfis = perfisOuPadrao(fd.getAll('perfis'));

  const sb = await criarClienteServidor();
  const agora = new Date().toISOString();
  const [{ count: membros }, { data: pendentes }, { data: plano }, { data: org }] = await Promise.all([
    sb.schema('agro').from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', perfil.org_id).in('role', ['consultor', 'admin']),
    sb.schema('agro').from('convites_equipe').select('email').is('usado_em', null).gt('expira_em', agora),
    sb.schema('agro').from('assinaturas').select('planos(usuarios_max)').maybeSingle(),
    sb.schema('agro').from('orgs').select('nome').eq('id', perfil.org_id).maybeSingle(),
  ]);

  if ((pendentes ?? []).some((p) => String(p.email).toLowerCase() === email)) {
    throw new ErroDeUsuario('Já existe um convite pendente para este e-mail. Cancele o anterior para enviar outro.');
  }
  const rel = (plano as { planos?: { usuarios_max: number } | { usuarios_max: number }[] | null } | null)?.planos;
  const limite = (Array.isArray(rel) ? rel[0] : rel)?.usuarios_max ?? null;
  if (limite != null && (membros ?? 0) + (pendentes ?? []).length >= limite) {
    throw new ErroDeUsuario(`O plano do escritório permite ${limite} usuário(s) (contando convites pendentes). Cancele um convite ou mude de plano.`);
  }

  const { data, error } = await sb.schema('agro').from('convites_equipe').insert({
    org_id: perfil.org_id, email, titulo, perfis, criado_por: perfil.id,
  }).select('token').single();
  if (error) lancarDoBanco(error);

  const link = `${await enderecoDoSite()}/equipe/aceitar?token=${data.token}`;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'AgroTech <no-reply@agrotech.campoforte.com.br>',
        to: email,
        subject: `Convite para o escritório ${org?.nome ?? ''} no AgroTech`,
        text: `${perfil.nome ?? 'Alguém'} convidou você para o escritório "${org?.nome ?? ''}" no AgroTech.\n\nCrie sua senha em: ${link}\n\nO link vale por 7 dias.`,
      }),
    }).catch(() => {});
  }

  await registrar(sb, {
    acao: 'equipe.convidado', entidade: 'convites_equipe', entidade_id: data.token, org_id: perfil.org_id,
    dados: { email, titulo, perfis, enviado: Boolean(resendKey) },
  });
  revalidatePath(CAMINHO);
}

async function cancelarConviteEquipeImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Convite não informado.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('convites_equipe').delete().eq('id', id).eq('org_id', perfil.org_id);
  if (error) lancarDoBanco(error);
  await registrar(sb, { acao: 'equipe.convite_cancelado', entidade: 'convites_equipe', entidade_id: id, org_id: perfil.org_id });
  revalidatePath(CAMINHO);
}

/** Troca os perfis de um colega. O banco recusa rebaixar o último proprietário (0037). */
async function alterarPerfisImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Integrante não informado.');
  if (id === perfil.id) throw new ErroDeUsuario('Para mudar o seu próprio acesso, peça a outro proprietário — assim o escritório nunca fica sem dono.');
  const perfis = perfisOuPadrao(fd.getAll('perfis'));

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('profiles')
    .update({ perfis }).eq('id', id).eq('org_id', perfil.org_id).select('nome').maybeSingle();
  if (error) lancarDoBanco(error);
  if (!data) throw new ErroDeUsuario('Integrante não encontrado neste escritório.');

  await registrar(sb, {
    acao: 'equipe.perfis_alterados', entidade: 'profiles', entidade_id: id, org_id: perfil.org_id,
    dados: { nome: data.nome, perfis },
  });
  revalidatePath(CAMINHO);
}

/** Tira um colega do escritório: ele perde o acesso aos dados (zera escritório, título e perfis). */
async function removerDaEquipeImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Integrante não informado.');
  if (id === perfil.id) throw new ErroDeUsuario('Você não pode se remover da própria equipe por aqui.');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('profiles')
    .update({ org_id: null, titulo: null, perfis: [] }).eq('id', id).eq('org_id', perfil.org_id).select('nome').maybeSingle();
  if (error) lancarDoBanco(error);
  if (!data) throw new ErroDeUsuario('Integrante não encontrado neste escritório.');

  await registrar(sb, {
    acao: 'equipe.removido', entidade: 'profiles', entidade_id: id, org_id: perfil.org_id, dados: { nome: data.nome },
  });
  revalidatePath(CAMINHO);
}

export const convidarEquipe = comAviso(convidarEquipeImpl);
export const cancelarConviteEquipe = comAviso(cancelarConviteEquipeImpl);
export const alterarPerfis = comAviso(alterarPerfisImpl);
export const removerDaEquipe = comAviso(removerDaEquipeImpl);
