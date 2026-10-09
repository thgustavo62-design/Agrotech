'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/** De volta à tela de onde veio — só para dentro do estúdio da Academy ou para a tela de visita/laudo da Assistência. */
function retornoSeguro(fd: FormData, padrao: string): string {
  const r = texto(fd, 'retorno');
  return /^\/(academy\/estudio|app\/(talhoes|analises|produtores|laudos))(\/[A-Za-z0-9_-]+)*$/.test(r) ? r : padrao;
}

/**
 * Indica um CURSO ou um CONTEÚDO publicado a um ou mais produtores, com recado e, se vier de uma visita ou análise, o contexto.
 * Quem já recebeu não recebe de novo (a indicação é única por alvo e produtor). O banco confere tudo de novo: alvo publicado,
 * produtor do mesmo escritório, visita/análise do mesmo produtor, e avisa o produtor no portal.
 */
async function indicarImpl(fd: FormData) {
  const perfil = await exigir('academy.indicar');
  const conteudoId = texto(fd, 'conteudo_id');
  const cursoId = texto(fd, 'curso_id');
  if (Boolean(conteudoId) === Boolean(cursoId)) throw new ErroDeUsuario('Escolha o curso ou o conteúdo que você quer indicar.');
  const alvo = conteudoId ? ({ campo: 'conteudo_id', id: conteudoId, rotulo: 'conteúdo', entidade: 'academy_conteudos', pagina: 'conteudos' } as const)
    : ({ campo: 'curso_id', id: cursoId, rotulo: 'curso', entidade: 'academy_cursos', pagina: 'cursos' } as const);
  if (!UUID.test(alvo.id)) throw new ErroDeUsuario(`${alvo.rotulo[0]!.toUpperCase()}${alvo.rotulo.slice(1)} inválido.`);

  const produtores = [...new Set(fd.getAll('produtor_id').map(String).filter((p) => UUID.test(p)))];
  if (produtores.length === 0) throw new ErroDeUsuario('Escolha pelo menos um produtor.');
  const mensagem = texto(fd, 'mensagem').trim();
  if (mensagem.length > 600) throw new ErroDeUsuario('O recado passa de 600 letras. Encurte.');
  const visita = texto(fd, 'visita_id');
  const analise = texto(fd, 'analise_id');
  if ((visita && !UUID.test(visita)) || (analise && !UUID.test(analise))) throw new ErroDeUsuario('Contexto inválido.');

  const sb = await criarClienteServidor();
  const { data: jaTem } = await sb.schema('agro').from('academy_indicacoes').select('produtor_id').eq(alvo.campo, alvo.id).in('produtor_id', produtores);
  const jaIndicados = new Set((jaTem ?? []).map((r) => r.produtor_id as string));
  const novos = produtores.filter((p) => !jaIndicados.has(p));
  if (novos.length === 0) throw new ErroDeUsuario(`Este ${alvo.rotulo} já foi indicado a quem você escolheu.`);

  const { error } = await sb.schema('agro').from('academy_indicacoes').insert(
    novos.map((produtor_id) => ({ [alvo.campo]: alvo.id, produtor_id, mensagem: mensagem || null, visita_id: visita || null, analise_id: analise || null })),
  );
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    org_id: perfil.org_id, acao: 'academy.indicado', entidade: alvo.entidade, entidade_id: alvo.id,
    dados: { produtores: novos.length, ja_indicados: jaIndicados.size, visita_id: visita || null, analise_id: analise || null },
  });
  const volta = retornoSeguro(fd, `/academy/estudio/${alvo.pagina}/${alvo.id}`);
  revalidatePath(volta);
  redirect(`${volta}?indicado=${novos.length}`);
}

async function desfazerIndicacaoImpl(fd: FormData) {
  const perfil = await exigir('academy.indicar');
  const id = texto(fd, 'id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Indicação inválida.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('academy_indicacoes').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  await registrar(sb, { org_id: perfil.org_id, acao: 'academy.indicacao_desfeita', entidade: 'academy_indicacoes', entidade_id: id });
  const volta = retornoSeguro(fd, '/academy/estudio');
  revalidatePath(volta);
  redirect(volta);
}

export const indicar = comAviso(indicarImpl);
export const desfazerIndicacao = comAviso(desfazerIndicacaoImpl);
