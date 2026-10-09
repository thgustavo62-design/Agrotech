'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor, perfilAtual, produtorAtual } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { COOKIE_AVISO, PARAM_AVISO, comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import {
  MAX_BYTES_ARQUIVO, MAX_FOTOS_POR_ENVIO, STATUS, dataValida, nomeSeguroDeAnexo, validarMensagem, validarPedido,
} from '@/lib/connect';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const idOuNulo = (fd: FormData, k: string): string | null => {
  const v = texto(fd, k).trim();
  if (!v) return null;
  if (!UUID.test(v)) throw new ErroDeUsuario('Seleção inválida. Recarregue a página e tente de novo.');
  return v;
};
const idObrigatorio = (fd: FormData, k: string): string => {
  const v = idOuNulo(fd, k);
  if (!v) throw new ErroDeUsuario('Pedido inválido.');
  return v;
};

/** Aviso que aparece na próxima tela mesmo quando a ação deu certo (ex.: "o pedido foi enviado, mas 1 foto falhou"). */
async function avisar(mensagem: string) {
  (await cookies()).set(COOKIE_AVISO, encodeURIComponent(mensagem.slice(0, 300)), { path: '/', maxAge: 60, sameSite: 'lax', httpOnly: false });
}

/** Redireciona para a MESMA página sem perder o aviso: o <AvisoFlash> só relê o cookie quando o caminho ou o marcador `_a` muda. */
const comMarca = (caminho: string) => `${caminho}?${PARAM_AVISO}=${Math.random().toString(36).slice(2, 8)}`;

function arquivosDoForm(fd: FormData): File[] {
  return fd.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
}

/**
 * Sobe os anexos para a pasta do pedido ({org}/{pedido}/…) e registra cada um. Devolve quantos falharam — o pedido/mensagem já
 * existe a essa altura, então uma foto ruim não pode apagar o texto que a pessoa escreveu.
 */
async function guardarArquivos(sb: SupabaseClient, alvo: { orgId: string; produtorId: string; pedidoId: string; mensagemId: string | null }, arquivos: File[]): Promise<number> {
  let falhas = 0;
  for (const f of arquivos.slice(0, MAX_FOTOS_POR_ENVIO)) {
    if (!MIMES.has(f.type) || f.size > MAX_BYTES_ARQUIVO) { falhas++; continue; }
    const caminho = `${alvo.orgId}/${alvo.pedidoId}/${randomUUID()}-${nomeSeguroDeAnexo(f.name)}`;
    const { error: eUp } = await sb.storage.from('atendimentos').upload(caminho, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (eUp) { falhas++; continue; }
    const { error } = await sb.schema('agro').from('atendimento_arquivos').insert({
      org_id: alvo.orgId, atendimento_id: alvo.pedidoId, mensagem_id: alvo.mensagemId, produtor_id: alvo.produtorId,
      storage_path: caminho, nome: f.name.slice(0, 200), mime: f.type, bytes: f.size,
    });
    if (error) { falhas++; await sb.storage.from('atendimentos').remove([caminho]); }
  }
  falhas += Math.max(0, arquivos.length - MAX_FOTOS_POR_ENVIO);
  return falhas;
}

const FRASE_FALHA = (n: number) => `${n === 1 ? '1 arquivo não pôde' : `${n} arquivos não puderam`} ser enviado${n === 1 ? '' : 's'} (só fotos JPG/PNG/WebP ou PDF de até 10 MB, no máximo ${MAX_FOTOS_POR_ENVIO} por envio). O restante foi enviado.`;

/** Pedido novo. O produtor abre o dele; a equipe (atendimento.gerir) abre em nome de um produtor, já com responsável/prazo. */
async function criarPedidoImpl(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('Entre para abrir um pedido.');
  const ehEquipe = perfil.role === 'consultor' || perfil.role === 'admin';

  let produtorId: string;
  if (ehEquipe) {
    await exigir('atendimento.gerir');
    const escolhido = idOuNulo(fd, 'produtor_id');
    if (!escolhido) throw new ErroDeUsuario('Escolha o produtor do pedido.');
    produtorId = escolhido;
  } else {
    const produtor = await produtorAtual();
    if (!produtor) throw new ErroDeUsuario('Só o produtor abre pedidos por aqui.');
    produtorId = produtor.id;
  }

  const v = validarPedido({ assunto: texto(fd, 'assunto'), descricao: texto(fd, 'descricao'), categoria: texto(fd, 'categoria'), urgente: texto(fd, 'urgente') === 'on' });
  if (!v.ok) throw new ErroDeUsuario(v.erro);

  const extra: Record<string, unknown> = {};
  if (ehEquipe) {
    const prioridade = texto(fd, 'prioridade');
    extra.prioridade = ['normal', 'alta', 'urgente'].includes(prioridade) ? prioridade : v.dados.prioridade;
    extra.responsavel_id = idOuNulo(fd, 'responsavel_id');
    const prazo = texto(fd, 'vencimento').trim();
    if (prazo) {
      if (!dataValida(prazo)) throw new ErroDeUsuario('O prazo precisa ser uma data válida.');
      extra.vencimento = prazo;
    }
  }

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('atendimentos').insert({
    org_id: perfil.org_id,
    produtor_id: produtorId,
    propriedade_id: idOuNulo(fd, 'propriedade_id'),
    talhao_id: idOuNulo(fd, 'talhao_id'),
    assunto: v.dados.assunto,
    descricao: v.dados.descricao,
    categoria: v.dados.categoria,
    prioridade: v.dados.prioridade,
    ...extra,
  }).select('id').single();
  if (error) lancarDoBanco(error);
  const pedidoId = (data as { id: string }).id;

  const falhas = await guardarArquivos(sb, { orgId: perfil.org_id, produtorId, pedidoId, mensagemId: null }, arquivosDoForm(fd));
  if (falhas > 0) await avisar(FRASE_FALHA(falhas));
  revalidatePath('/connect', 'layout');
  redirect(ehEquipe ? `/connect/atendimentos/${pedidoId}` : `/connect/pedidos/${pedidoId}`);
}

/** Resposta na conversa. A equipe pode marcar "nota interna" (o produtor nunca vê); o banco impede o produtor de fazê-lo. */
async function responderPedidoImpl(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('Entre para responder.');
  const ehEquipe = perfil.role === 'consultor' || perfil.role === 'admin';
  if (ehEquipe) await exigir('atendimento.gerir');
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const arquivos = arquivosDoForm(fd);
  const m = validarMensagem(texto(fd, 'corpo'), arquivos.length > 0);
  if (!m.ok) throw new ErroDeUsuario(m.erro);

  const sb = await criarClienteServidor();
  const { data: pedido } = await sb.schema('agro').from('atendimentos').select('id, produtor_id').eq('id', pedidoId).maybeSingle();
  if (!pedido) throw new ErroDeUsuario('Pedido não encontrado.');

  const { data, error } = await sb.schema('agro').from('atendimento_mensagens').insert({
    org_id: perfil.org_id,
    atendimento_id: pedidoId,
    produtor_id: (pedido as { produtor_id: string }).produtor_id,
    autor_tipo: ehEquipe ? 'equipe' : 'produtor',
    corpo: m.corpo,
    interna: ehEquipe && texto(fd, 'interna') === 'on',
  }).select('id').single();
  if (error) lancarDoBanco(error);

  const falhas = await guardarArquivos(sb, { orgId: perfil.org_id, produtorId: (pedido as { produtor_id: string }).produtor_id, pedidoId, mensagemId: (data as { id: string }).id }, arquivos);
  if (falhas > 0) await avisar(FRASE_FALHA(falhas));
  revalidatePath('/connect', 'layout');
  // volta à própria conversa (renova a tela e mostra o aviso de arquivos que falharam, se houver)
  redirect(comMarca(`/connect/${ehEquipe ? 'atendimentos' : 'pedidos'}/${pedidoId}`));
}

/** O produtor avalia o atendimento resolvido (uma vez). Quem confere as regras é a função do banco. */
async function avaliarPedidoImpl(fd: FormData) {
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const nota = Number(texto(fd, 'nota'));
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new ErroDeUsuario('Escolha uma nota de 1 a 5.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').rpc('avaliar_atendimento', { p_id: pedidoId, p_nota: nota, p_comentario: texto(fd, 'comentario').trim() || null });
  if (error) lancarDoBanco(error);
  revalidatePath(`/connect/pedidos/${pedidoId}`);
}

/** Mudar a situação do pedido (equipe). */
async function mudarSituacaoImpl(fd: FormData) {
  await exigir('atendimento.gerir');
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const status = texto(fd, 'status');
  if (!(STATUS as string[]).includes(status)) throw new ErroDeUsuario('Situação inválida.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('atendimentos').update({ status }).eq('id', pedidoId);
  if (error) lancarDoBanco(error);
  revalidatePath('/connect', 'layout');
}

/** Responsável, prioridade e prazo de uma vez (equipe). Vazio em responsável/prazo = sem. */
async function atualizarPedidoImpl(fd: FormData) {
  await exigir('atendimento.gerir');
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const prioridade = texto(fd, 'prioridade');
  if (!['normal', 'alta', 'urgente'].includes(prioridade)) throw new ErroDeUsuario('Prioridade inválida.');
  const prazo = texto(fd, 'vencimento').trim();
  if (prazo && !dataValida(prazo)) throw new ErroDeUsuario('O prazo precisa ser uma data válida.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('atendimentos').update({
    responsavel_id: idOuNulo(fd, 'responsavel_id'), prioridade, vencimento: prazo || null,
  }).eq('id', pedidoId);
  if (error) lancarDoBanco(error);
  revalidatePath('/connect', 'layout');
}

/** "Assumir": o pedido passa a ser meu. */
async function assumirPedidoImpl(fd: FormData) {
  const perfil = await exigir('atendimento.gerir');
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('atendimentos').update({ responsavel_id: perfil.id }).eq('id', pedidoId);
  if (error) lancarDoBanco(error);
  revalidatePath('/connect', 'layout');
}

/** Marca um retorno na agenda do escritório, ligado ao produtor (e ao talhão) do pedido. */
async function agendarRetornoImpl(fd: FormData) {
  const perfil = await exigir('atendimento.gerir');
  const pedidoId = idObrigatorio(fd, 'pedido_id');
  const data = texto(fd, 'data').trim();
  if (!dataValida(data)) throw new ErroDeUsuario('Escolha a data do retorno.');
  const sb = await criarClienteServidor();
  const { data: pedido } = await sb.schema('agro').from('atendimentos').select('assunto, produtor_id, talhao_id').eq('id', pedidoId).maybeSingle();
  if (!pedido) throw new ErroDeUsuario('Pedido não encontrado.');
  const p = pedido as { assunto: string; produtor_id: string; talhao_id: string | null };
  const { error } = await sb.schema('agro').from('agenda_eventos').insert({
    org_id: perfil.org_id, consultor_id: perfil.id, produtor_id: p.produtor_id, talhao_id: p.talhao_id,
    tipo: 'retorno', titulo: `Retorno: ${p.assunto}`.slice(0, 160), data, observacao: 'Combinado pelo Connect.',
  });
  if (error) lancarDoBanco(error);
  await avisar('Retorno marcado na agenda.');
  redirect(comMarca(`/connect/atendimentos/${pedidoId}`));
}

export const criarPedido = comAviso(criarPedidoImpl);
export const responderPedido = comAviso(responderPedidoImpl);
export const avaliarPedido = comAviso(avaliarPedidoImpl);
export const mudarSituacao = comAviso(mudarSituacaoImpl);
export const atualizarPedido = comAviso(atualizarPedidoImpl);
export const assumirPedido = comAviso(assumirPedidoImpl);
export const agendarRetorno = comAviso(agendarRetornoImpl);

/** Avisos do Connect: marcar um (ou todos) como lido. */
async function marcarAvisoLidoImpl(fd: FormData) {
  const id = idObrigatorio(fd, 'id');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('notificacoes').update({ lida_em: new Date().toISOString() }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath('/connect', 'layout');
}

async function marcarTodosAvisosImpl() {
  const perfil = await perfilAtual();
  if (!perfil) throw new ErroDeUsuario('Sessão inválida.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('notificacoes').update({ lida_em: new Date().toISOString() })
    .eq('destinatario_user_id', perfil.id).is('lida_em', null);
  if (error) lancarDoBanco(error);
  revalidatePath('/connect', 'layout');
}

export const marcarAvisoLido = comAviso(marcarAvisoLidoImpl);
export const marcarTodosAvisos = comAviso(marcarTodosAvisosImpl);
