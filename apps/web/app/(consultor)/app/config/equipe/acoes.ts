'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { perfisOuPadrao } from '@/lib/permissoes';
import { regrasDaSenha } from '@/lib/senha';
import { registrar } from '@/lib/audit';
import { comAviso, ehControleDoNext, ErroDeUsuario, lancarDoBanco, MENSAGEM_GENERICA } from '@/lib/acao';
import { clienteAdmin } from '@/lib/supabase/admin';
import { linkDeRedefinicao } from '@/lib/acesso-equipe';
import { enderecoDoSite } from './dados';

const CAMINHO = '/app/config/equipe';
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Perfil = Awaited<ReturnType<typeof exigir>>;

/** Garante vaga no plano (membros + convites pendentes < usuarios_max). Devolve os convites pendentes. */
async function garantirVaga(sb: SupabaseClient, orgId: string): Promise<Array<{ email: string }>> {
  const agora = new Date().toISOString();
  const [{ count: membros }, { data: pendentes }, { data: plano }] = await Promise.all([
    sb.schema('agro').from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', orgId).in('role', ['consultor', 'admin']),
    sb.schema('agro').from('convites_equipe').select('email').is('usado_em', null).gt('expira_em', agora),
    sb.schema('agro').from('assinaturas').select('planos(usuarios_max)').maybeSingle(),
  ]);
  const rel = (plano as { planos?: { usuarios_max: number } | { usuarios_max: number }[] | null } | null)?.planos;
  const limite = (Array.isArray(rel) ? rel[0] : rel)?.usuarios_max ?? null;
  const lista = (pendentes ?? []) as Array<{ email: string }>;
  if (limite != null && (membros ?? 0) + lista.length >= limite) {
    throw new ErroDeUsuario(`O plano do escritório permite ${limite} usuário(s) (contando convites pendentes). Remova alguém, cancele um convite ou mude de plano.`);
  }
  return lista;
}

/** Convida alguém por link (a pessoa cria a própria senha) já com os perfis escolhidos (migration 0037). */
async function convidarEquipeImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const titulo = String(fd.get('titulo') ?? '').trim().slice(0, 60) || null;
  if (!RE_EMAIL.test(email)) throw new ErroDeUsuario('Informe um e-mail válido.');
  const perfis = perfisOuPadrao(fd.getAll('perfis'));

  const sb = await criarClienteServidor();
  const [pendentes, { data: org }] = await Promise.all([
    garantirVaga(sb, perfil.org_id),
    sb.schema('agro').from('orgs').select('nome').eq('id', perfil.org_id).maybeSingle(),
  ]);
  if (pendentes.some((p) => String(p.email).toLowerCase() === email)) {
    throw new ErroDeUsuario('Já existe um convite pendente para este e-mail. Cancele o anterior para enviar outro.');
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

/**
 * Remove um colega: a conta é DESATIVADA (não só desvinculada). Sem isso a pessoa entrava de novo e ganhava um
 * escritório de teste vazio. Ordem: 1) bane o login no Auth e libera o e-mail (renomeia para um endereço morto,
 * assim dá para cadastrar outra pessoa — ou a mesma — com ele); 2) zera escritório/perfis e marca `desativado_em`
 * (migration 0039: o banco recusa qualquer escrita com o token antigo; a leitura cai quando o token expira, ≤ 1 h).
 * A conta NÃO é apagada: laudos e recomendações guardam quem os emitiu (as chaves viram null ao excluir).
 */
async function removerDaEquipeImpl(fd: FormData) {
  const perfil = await exigir('equipe.gerenciar');
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Integrante não informado.');
  if (id === perfil.id) throw new ErroDeUsuario('Você não pode se remover da própria equipe por aqui.');

  const sb = await criarClienteServidor();
  const { data: alvo } = await sb.schema('agro').from('profiles')
    .select('id, nome, role, perfis').eq('id', id).eq('org_id', perfil.org_id).maybeSingle();
  if (!alvo || (alvo.role !== 'consultor' && alvo.role !== 'admin')) throw new ErroDeUsuario('Integrante não encontrado neste escritório.');
  const eraProprietario = (alvo.perfis as string[] | null)?.includes('proprietario');
  if (eraProprietario) {
    // antes de banir: se for o último proprietário o banco recusa depois e a conta ficaria banida à toa
    const { count } = await sb.schema('agro').from('profiles').select('*', { count: 'exact', head: true })
      .eq('org_id', perfil.org_id).contains('perfis', ['proprietario']).neq('id', id);
    if (!count) throw new ErroDeUsuario('O escritório precisa de pelo menos um proprietário.');
  }

  const admin = adminOuErro();
  const { error: eBan } = await admin.auth.admin.updateUserById(id, {
    ban_duration: '876000h', // ~100 anos: o login e a renovação da sessão deixam de funcionar
    email: `removido-${id}@removido.invalid`,
    email_confirm: true,
  });
  if (eBan) {
    console.error('[removerDaEquipe] ban', eBan);
    throw new ErroDeUsuario('Não foi possível desativar o acesso agora. Nada foi alterado; tente de novo.');
  }

  const { error: ePerfil } = await admin.schema('agro').from('profiles')
    .update({ org_id: null, titulo: null, perfis: [], desativado_em: new Date().toISOString() }).eq('id', id);
  if (ePerfil) {
    console.error('[removerDaEquipe] perfil', ePerfil);
    throw new ErroDeUsuario('O acesso foi bloqueado, mas não consegui tirar a pessoa do escritório. Tente remover de novo.');
  }

  await registrar(sb, {
    acao: 'equipe.removido', entidade: 'profiles', entidade_id: id, org_id: perfil.org_id, dados: { nome: alvo.nome },
  });
  revalidatePath(CAMINHO);
}

// ---------------------------------------------------------------------------------------------
// Ações que DEVOLVEM resultado (a tela precisa mostrar e-mail/senha/link na hora, sem redirecionar)
// ---------------------------------------------------------------------------------------------

/** Colega cuja conta o proprietário pode mexer: do mesmo escritório, da equipe, que não seja ele nem outro proprietário. */
async function alvoGerenciavel(sb: SupabaseClient, perfil: Perfil, id: string) {
  if (!id) throw new ErroDeUsuario('Integrante não informado.');
  if (id === perfil.id) throw new ErroDeUsuario('Para trocar a sua própria senha, use Configurações → Meu perfil.');
  const { data: alvo } = await sb.schema('agro').from('profiles')
    .select('id, nome, role, perfis').eq('id', id).eq('org_id', perfil.org_id).maybeSingle();
  if (!alvo || (alvo.role !== 'consultor' && alvo.role !== 'admin')) throw new ErroDeUsuario('Integrante não encontrado neste escritório.');
  if ((alvo.perfis as string[] | null)?.includes('proprietario')) {
    throw new ErroDeUsuario('A senha de outro proprietário só ele mesmo (ou o painel do Supabase) pode trocar.');
  }
  return alvo as { id: string; nome: string | null };
}

function adminOuErro() {
  const admin = clienteAdmin();
  if (!admin) throw new ErroDeUsuario('Este recurso precisa da SUPABASE_SERVICE_ROLE_KEY configurada no servidor.');
  return admin;
}

function exigirSenhaValida(senha: string) {
  if (!regrasDaSenha(senha).every((r) => r.ok)) throw new ErroDeUsuario('A senha precisa ter pelo menos 8 caracteres, com letras e números.');
}

async function comResultado<T extends { ok: true }>(nome: string, corpo: () => Promise<T>): Promise<T | { ok: false; mensagem: string }> {
  try {
    return await corpo();
  } catch (e) {
    if (ehControleDoNext(e)) throw e;
    if (e instanceof ErroDeUsuario) return { ok: false, mensagem: e.message };
    console.error(`[${nome}]`, e);
    return { ok: false, mensagem: MENSAGEM_GENERICA };
  }
}

export type ResultadoCadastro = { ok: true; nome: string; email: string } | { ok: false; mensagem: string };

/**
 * O proprietário cadastra o empregado direto: cria a conta com e-mail e senha (já confirmada — não depende de
 * e-mail) e a põe no escritório com os perfis escolhidos. A pessoa entra pelo login normal. Exige a service role.
 * O gatilho de cadastro cria o perfil como consultor/proprietário; aqui ele é logo rebaixado ao que foi pedido.
 */
export async function cadastrarEmpregado(fd: FormData): Promise<ResultadoCadastro> {
  return comResultado('cadastrarEmpregado', async () => {
    const perfil = await exigir('equipe.gerenciar');
    const nome = String(fd.get('nome') ?? '').trim().slice(0, 80);
    const email = String(fd.get('email') ?? '').trim().toLowerCase();
    const titulo = String(fd.get('titulo') ?? '').trim().slice(0, 60) || null;
    const senha = String(fd.get('senha') ?? '');
    if (!nome) throw new ErroDeUsuario('Informe o nome da pessoa.');
    if (!RE_EMAIL.test(email)) throw new ErroDeUsuario('Informe um e-mail válido.');
    exigirSenhaValida(senha);
    const perfis = perfisOuPadrao(fd.getAll('perfis'));

    const sb = await criarClienteServidor();
    await garantirVaga(sb, perfil.org_id);
    const admin = adminOuErro();

    const { data: criado, error: eCria } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome, role: 'consultor' },
    });
    if (eCria || !criado?.user) {
      if (eCria && /already|registered|exists/i.test(eCria.message)) {
        throw new ErroDeUsuario('Este e-mail já tem cadastro no AgroTech. Use outro e-mail para esta pessoa.');
      }
      console.error('[cadastrarEmpregado] createUser', eCria);
      throw new ErroDeUsuario('Não foi possível criar o acesso agora. Tente de novo em instantes.');
    }

    const { error: ePerfil } = await admin.schema('agro').from('profiles')
      .update({ org_id: perfil.org_id, nome, titulo, perfis, role: 'consultor' }).eq('id', criado.user.id);
    if (ePerfil) {
      console.error('[cadastrarEmpregado] perfil', ePerfil);
      await admin.auth.admin.deleteUser(criado.user.id); // não deixa conta solta, sem escritório
      throw new ErroDeUsuario('Não foi possível colocar a pessoa no escritório. Nada foi criado; tente de novo.');
    }

    await registrar(sb, {
      acao: 'equipe.cadastrado', entidade: 'profiles', entidade_id: criado.user.id, org_id: perfil.org_id,
      dados: { nome, email, titulo, perfis },
    });
    revalidatePath(CAMINHO);
    return { ok: true as const, nome, email };
  });
}

export type ResultadoSenha = { ok: true; nome: string | null; email: string } | { ok: false; mensagem: string };

/** O proprietário define a nova senha de um empregado (esqueceu, ou a provisória vazou). Vale na hora. */
export async function definirSenhaEquipe(fd: FormData): Promise<ResultadoSenha> {
  return comResultado('definirSenhaEquipe', async () => {
    const perfil = await exigir('equipe.gerenciar');
    const senha = String(fd.get('senha') ?? '');
    exigirSenhaValida(senha);
    const sb = await criarClienteServidor();
    const alvo = await alvoGerenciavel(sb, perfil, String(fd.get('id') ?? ''));
    const admin = adminOuErro();

    const { data, error } = await admin.auth.admin.updateUserById(alvo.id, { password: senha });
    if (error || !data?.user?.email) {
      console.error('[definirSenhaEquipe]', error);
      throw new ErroDeUsuario('Não foi possível trocar a senha agora. Tente de novo em instantes.');
    }
    await registrar(sb, {
      acao: 'equipe.senha_definida', entidade: 'profiles', entidade_id: alvo.id, org_id: perfil.org_id, dados: { nome: alvo.nome },
    });
    return { ok: true as const, nome: alvo.nome, email: data.user.email };
  });
}

export type ResultadoAcesso = { ok: true; link: string; nome: string | null } | { ok: false; mensagem: string };

/**
 * Alternativa à senha direta: gera um link de nova senha (uso único, ~1 hora) para o empregado criar a dele.
 * Nada é enviado por e-mail e o link não fica guardado.
 */
export async function gerarAcessoEquipe(fd: FormData): Promise<ResultadoAcesso> {
  return comResultado('gerarAcessoEquipe', async () => {
    const perfil = await exigir('equipe.gerenciar');
    const sb = await criarClienteServidor();
    const alvo = await alvoGerenciavel(sb, perfil, String(fd.get('id') ?? ''));
    const admin = adminOuErro();

    const { data: usuario, error: eUsuario } = await admin.auth.admin.getUserById(alvo.id);
    const email = usuario?.user?.email;
    if (eUsuario || !email) throw new ErroDeUsuario('Não encontrei o acesso desta pessoa.');
    const { data: gerado, error: eLink } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    const tokenHash = gerado?.properties?.hashed_token;
    if (eLink || !tokenHash) {
      console.error('[gerarAcessoEquipe]', eLink);
      throw new ErroDeUsuario('Não foi possível gerar o link agora. Tente de novo em instantes.');
    }

    await registrar(sb, {
      acao: 'equipe.acesso_gerado', entidade: 'profiles', entidade_id: alvo.id, org_id: perfil.org_id, dados: { nome: alvo.nome },
    });
    return { ok: true as const, link: linkDeRedefinicao(await enderecoDoSite(), tokenHash), nome: alvo.nome };
  });
}

export const convidarEquipe = comAviso(convidarEquipeImpl);
export const cancelarConviteEquipe = comAviso(cancelarConviteEquipeImpl);
export const alterarPerfis = comAviso(alterarPerfisImpl);
export const removerDaEquipe = comAviso(removerDaEquipeImpl);
