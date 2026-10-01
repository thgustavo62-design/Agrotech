'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { clienteAdmin } from '@/lib/supabase/admin';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

/** Cria um link público de resultados para o produtor (cultura opcional). */
async function criarCompartilhamentoImpl(fd: FormData) {
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const culturaRaw = String(fd.get('cultura') ?? '').trim();
  const cultura = culturaRaw === '' || culturaRaw === '__todas' ? null : culturaRaw;
  const rotulo = String(fd.get('rotulo') ?? '').trim() || null;
  if (!produtor_id) throw new ErroDeUsuario('produtor não informado');

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('sessão inválida');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('compartilhamentos').insert({
    org_id: perfil.org_id,
    produtor_id,
    cultura,
    rotulo,
  }).select('id, token').single();
  if (error) lancarDoBanco(error);
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
async function convidarProdutorImpl(fd: FormData) {
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!produtor_id || !email) throw new ErroDeUsuario('produtor e e-mail são obrigatórios');

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('sessão inválida');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('convites').insert({
    org_id: perfil.org_id,
    produtor_id,
    email,
  }).select('token').single();
  if (error) lancarDoBanco(error);

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
async function excluirProdutorImpl(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const confirmar = String(fd.get('confirmar') ?? '');
  if (!id) throw new ErroDeUsuario('produtor não informado');
  if (confirmar !== 'EXCLUIR') throw new ErroDeUsuario('digite EXCLUIR para confirmar');

  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();

  // Lido antes de apagar (pela RLS do consultor): depois do delete o vínculo some.
  const { data: produtor } = await sb.schema('agro').from('produtores').select('user_id').eq('id', id).maybeSingle();
  const contaAuth = (produtor?.user_id as string | null | undefined) ?? null;

  await registrar(sb, {
    acao: 'produtor.excluido_lgpd',
    entidade: 'produtores',
    entidade_id: id,
    org_id: perfil?.org_id ?? null,
  });

  const { error } = await sb.schema('agro').from('produtores').delete().eq('id', id);
  if (error) lancarDoBanco(error);

  if (contaAuth) await eliminarContaDoProdutor(sb, contaAuth, id, perfil?.org_id ?? null);
  redirect('/app/produtores');
}

/** Elimina a conta de auth do produtor (e, por cascata, profile e notificações).
 *  Só apaga se for conta de produtor e não estiver ligada a outro cadastro —
 *  nunca uma conta de consultor. Falha alta: os dados de negócio já foram
 *  apagados, então o consultor precisa saber que a conta ficou pendente. */
async function eliminarContaDoProdutor(sb: SupabaseClient, userId: string, produtorId: string, orgId: string | null) {
  const registrarConta = (resultado: string) =>
    registrar(sb, {
      acao: 'produtor.conta_auth_lgpd',
      entidade: 'produtores',
      entidade_id: produtorId,
      org_id: orgId,
      dados: { resultado },
    });

  const admin = clienteAdmin();
  if (!admin) {
    await registrarConta('pendente: SUPABASE_SERVICE_ROLE_KEY ausente');
    throw new ErroDeUsuario('Dados apagados, mas a conta de acesso do produtor não pôde ser removida (service role não configurada). Remova-a no painel do Supabase.');
  }

  const { data: perfil } = await admin.schema('agro').from('profiles').select('role').eq('id', userId).maybeSingle();
  if (perfil && perfil.role !== 'produtor') {
    await registrarConta('ignorada: conta não é de produtor');
    return;
  }
  const { count } = await admin.schema('agro').from('produtores').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (count) {
    await registrarConta('ignorada: conta ligada a outro cadastro');
    return;
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await registrarConta(`pendente: ${error.message}`);
    throw new ErroDeUsuario(`Dados apagados, mas a conta de acesso do produtor não foi removida: ${error.message}`);
  }
  await registrarConta('eliminada');
}

async function alternarCompartilhamentoImpl(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const ativo = String(fd.get('ativo') ?? '') === 'true';
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('compartilhamentos').update({ ativo: !ativo }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath(`/app/produtores/${produtor_id}`);
}

export const criarCompartilhamento = comAviso(criarCompartilhamentoImpl);
export const convidarProdutor = comAviso(convidarProdutorImpl);
export const excluirProdutor = comAviso(excluirProdutorImpl);
export const alternarCompartilhamento = comAviso(alternarCompartilhamentoImpl);
