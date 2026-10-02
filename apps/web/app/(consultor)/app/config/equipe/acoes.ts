'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { perfisOuPadrao } from '@/lib/permissoes';
import { registrar } from '@/lib/audit';
import { comAviso, ehControleDoNext, ErroDeUsuario, lancarDoBanco, MENSAGEM_GENERICA } from '@/lib/acao';
import { clienteAdmin } from '@/lib/supabase/admin';
import { linkDeRedefinicao } from '@/lib/acesso-equipe';
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

export type ResultadoAcesso = { ok: true; link: string; nome: string | null } | { ok: false; mensagem: string };

/**
 * Empregado esqueceu a senha: o proprietário gera um link de nova senha (uso único, vale ~1 hora — padrão do
 * Supabase) e entrega por WhatsApp; nada é enviado por e-mail e o link não fica guardado. Devolve o resultado
 * em vez de redirecionar (o link precisa aparecer na tela). Não vale para proprietários (um não pode tomar a
 * conta do outro) nem para si mesmo (Configurações → Meu perfil).
 */
export async function gerarAcessoEquipe(fd: FormData): Promise<ResultadoAcesso> {
  try {
    const perfil = await exigir('equipe.gerenciar');
    const id = String(fd.get('id') ?? '');
    if (!id) throw new ErroDeUsuario('Integrante não informado.');
    if (id === perfil.id) throw new ErroDeUsuario('Para trocar a sua própria senha, use Configurações → Meu perfil.');

    const sb = await criarClienteServidor();
    const { data: alvo } = await sb.schema('agro').from('profiles')
      .select('id, nome, role, perfis').eq('id', id).eq('org_id', perfil.org_id).maybeSingle();
    if (!alvo || (alvo.role !== 'consultor' && alvo.role !== 'admin')) throw new ErroDeUsuario('Integrante não encontrado neste escritório.');
    if ((alvo.perfis as string[] | null)?.includes('proprietario')) {
      throw new ErroDeUsuario('A senha de outro proprietário só ele mesmo (ou o painel do Supabase) pode trocar.');
    }

    const admin = clienteAdmin();
    if (!admin) throw new ErroDeUsuario('Este recurso precisa da SUPABASE_SERVICE_ROLE_KEY configurada no servidor.');
    const { data: usuario, error: eUsuario } = await admin.auth.admin.getUserById(id);
    const email = usuario?.user?.email;
    if (eUsuario || !email) throw new ErroDeUsuario('Não encontrei o acesso desta pessoa.');
    const { data: gerado, error: eLink } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    const tokenHash = gerado?.properties?.hashed_token;
    if (eLink || !tokenHash) {
      console.error('[gerarAcessoEquipe]', eLink);
      throw new ErroDeUsuario('Não foi possível gerar o link agora. Tente de novo em instantes.');
    }

    await registrar(sb, {
      acao: 'equipe.acesso_gerado', entidade: 'profiles', entidade_id: id, org_id: perfil.org_id, dados: { nome: alvo.nome },
    });
    return { ok: true, link: linkDeRedefinicao(await enderecoDoSite(), tokenHash), nome: alvo.nome };
  } catch (e) {
    if (ehControleDoNext(e)) throw e;
    if (e instanceof ErroDeUsuario) return { ok: false, mensagem: e.message };
    console.error('[gerarAcessoEquipe]', e);
    return { ok: false, mensagem: MENSAGEM_GENERICA };
  }
}

export const convidarEquipe = comAviso(convidarEquipeImpl);
export const cancelarConviteEquipe = comAviso(cancelarConviteEquipeImpl);
export const alterarPerfis = comAviso(alterarPerfisImpl);
export const removerDaEquipe = comAviso(removerDaEquipeImpl);
