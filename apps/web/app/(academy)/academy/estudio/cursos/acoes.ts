'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { tipoDeImagem } from '@/lib/arquivos';
import { nomeSeguroDeArquivo } from '@/lib/academy';
import { mover, validarCurso } from '@/lib/academy-cursos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const MAX_CAPA = 5 * 1024 * 1024;

type Intencao = 'rascunho' | 'publicar' | 'arquivar' | 'salvar';
interface CursoAtual { id: string; status: string; capa_path: string | null }

/** Fica na página do curso, na parte da estrutura. */
function voltar(cursoId: string, ancora = 'estrutura'): never {
  revalidatePath(`/academy/estudio/cursos/${cursoId}`);
  redirect(`/academy/estudio/cursos/${cursoId}#${ancora}`);
}

/**
 * Cria ou edita um curso (os dados, a capa e quem vê). `intencao` vem do botão apertado, como nos conteúdos.
 * Publicar exige aulas e todas publicadas — o banco confere (0048) e a mensagem dele chega até a tela.
 */
async function salvarCursoImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const sb = await criarClienteServidor();

  const idEnviado = texto(fd, 'id');
  if (idEnviado && !UUID.test(idEnviado)) throw new ErroDeUsuario('Curso inválido.');
  const intencao = texto(fd, 'intencao') as Intencao;
  if (!['rascunho', 'publicar', 'arquivar', 'salvar'].includes(intencao)) throw new ErroDeUsuario('Ação inválida.');

  let atual: CursoAtual | null = null;
  if (idEnviado) {
    const { data } = await sb.schema('agro').from('academy_cursos').select('id, status, capa_path').eq('id', idEnviado).maybeSingle();
    if (!data) throw new ErroDeUsuario('Curso não encontrado.');
    atual = data as CursoAtual;
  }
  const id = atual?.id ?? crypto.randomUUID();

  const valido = validarCurso({
    titulo: texto(fd, 'titulo'), resumo: texto(fd, 'resumo'), descricao: texto(fd, 'descricao'), cultura: texto(fd, 'cultura'),
    tema: texto(fd, 'tema'), nivel: texto(fd, 'nivel'), visibilidade: texto(fd, 'visibilidade'),
  });
  if (!valido.ok) throw new ErroDeUsuario(valido.erro);
  const d = valido.dados;

  const statusFinal = intencao === 'publicar' ? 'publicado' : intencao === 'arquivar' ? 'arquivado' : intencao === 'rascunho' ? 'rascunho' : (atual?.status ?? 'rascunho');
  const escolhidos = [...new Set(fd.getAll('produtor_id').map(String).filter((p) => UUID.test(p)))];
  if (statusFinal === 'publicado' && d.visibilidade === 'selecionados' && escolhidos.length === 0) {
    throw new ErroDeUsuario('Escolha pelo menos um produtor, ou deixe o curso para todos.');
  }

  // capa nova (imagem; confere o CONTEÚDO do arquivo, não a extensão)
  const enviada = fd.get('capa');
  const novaCapa = enviada instanceof File && enviada.size > 0 ? enviada : null;
  let bytes: Uint8Array | null = null;
  let mime = '';
  if (novaCapa) {
    if (novaCapa.size > MAX_CAPA) throw new ErroDeUsuario('A capa passa de 5 MB. Reduza e envie de novo.');
    bytes = new Uint8Array(await novaCapa.arrayBuffer());
    mime = tipoDeImagem(bytes) ?? '';
    if (!mime) throw new ErroDeUsuario('A capa precisa ser uma imagem (JPG, PNG ou WebP).');
  }
  let caminhoNovo: string | null = null;
  if (novaCapa && bytes) {
    caminhoNovo = `${perfil.org_id}/cursos/${id}/${crypto.randomUUID()}-${nomeSeguroDeArquivo(novaCapa.name)}`;
    const { error: eUp } = await sb.storage.from('academy').upload(caminhoNovo, bytes, { contentType: mime });
    if (eUp) throw new ErroDeUsuario('Não foi possível enviar a capa agora. Tente de novo.');
  }
  const removerCapa = texto(fd, 'remover_capa') === 'on';
  const capaFinal = caminhoNovo ?? (removerCapa ? null : (atual?.capa_path ?? null));

  const linha = {
    ...d, status: statusFinal, capa_path: capaFinal,
    destaque: texto(fd, 'destaque') === 'on',
    certificado: texto(fd, 'certificado') === 'on',
  };
  const { error } = atual
    ? await sb.schema('agro').from('academy_cursos').update(linha).eq('id', id)
    : await sb.schema('agro').from('academy_cursos').insert({ id, org_id: perfil.org_id, ...linha });
  if (error) {
    if (caminhoNovo) await sb.storage.from('academy').remove([caminhoNovo]);
    lancarDoBanco(error);
  }

  await sb.schema('agro').from('academy_curso_publicos').delete().eq('curso_id', id);
  if (d.visibilidade === 'selecionados' && escolhidos.length > 0) {
    const { error: eP } = await sb.schema('agro').from('academy_curso_publicos').insert(escolhidos.map((produtor_id) => ({ curso_id: id, produtor_id })));
    if (eP) lancarDoBanco(eP);
  }
  if (atual?.capa_path && atual.capa_path !== capaFinal) await sb.storage.from('academy').remove([atual.capa_path]);

  await registrar(sb, {
    org_id: perfil.org_id, acao: atual ? `academy.curso_${intencao}` : 'academy.curso_criado', entidade: 'academy_cursos', entidade_id: id,
    dados: { titulo: d.titulo, status: statusFinal, visibilidade: d.visibilidade, selecionados: escolhidos.length },
  });
  revalidatePath('/academy/estudio/cursos');
  redirect(`/academy/estudio/cursos/${id}`);
}

async function excluirCursoImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const id = texto(fd, 'id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Curso inválido.');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('academy_cursos').select('titulo, capa_path').eq('id', id).maybeSingle();
  if (!data) throw new ErroDeUsuario('Curso não encontrado.');
  const { error } = await sb.schema('agro').from('academy_cursos').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  if (data.capa_path) await sb.storage.from('academy').remove([data.capa_path as string]);
  await registrar(sb, { org_id: perfil.org_id, acao: 'academy.curso_excluido', entidade: 'academy_cursos', entidade_id: id, dados: { titulo: data.titulo } });
  revalidatePath('/academy/estudio/cursos');
  redirect('/academy/estudio/cursos');
}

// ---------------------------------------------------------------------------------------------------------------------
// estrutura: módulos e aulas
// ---------------------------------------------------------------------------------------------------------------------

async function adicionarModuloImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const titulo = texto(fd, 'titulo').trim();
  if (!UUID.test(cursoId)) throw new ErroDeUsuario('Curso inválido.');
  if (titulo.length < 1 || titulo.length > 160) throw new ErroDeUsuario('Dê um nome ao módulo (até 160 letras).');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('academy_curso_modulos').select('posicao').eq('curso_id', cursoId).order('posicao', { ascending: false }).limit(1);
  const proxima = ((data?.[0]?.posicao as number | undefined) ?? -1) + 1;
  const { error } = await sb.schema('agro').from('academy_curso_modulos').insert({ curso_id: cursoId, titulo, posicao: proxima });
  if (error) lancarDoBanco(error);
  voltar(cursoId);
}

async function renomearModuloImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const moduloId = texto(fd, 'modulo_id');
  const titulo = texto(fd, 'titulo').trim();
  if (!UUID.test(cursoId) || !UUID.test(moduloId)) throw new ErroDeUsuario('Módulo inválido.');
  if (titulo.length < 1 || titulo.length > 160) throw new ErroDeUsuario('Dê um nome ao módulo (até 160 letras).');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('academy_curso_modulos').update({ titulo }).eq('id', moduloId);
  if (error) lancarDoBanco(error);
  voltar(cursoId);
}

async function removerModuloImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const moduloId = texto(fd, 'modulo_id');
  if (!UUID.test(cursoId) || !UUID.test(moduloId)) throw new ErroDeUsuario('Módulo inválido.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('academy_curso_modulos').delete().eq('id', moduloId);
  if (error) lancarDoBanco(error);
  voltar(cursoId);
}

async function moverModuloImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const moduloId = texto(fd, 'modulo_id');
  const direcao = texto(fd, 'direcao');
  if (!UUID.test(cursoId) || !UUID.test(moduloId) || (direcao !== 'subir' && direcao !== 'descer')) throw new ErroDeUsuario('Módulo inválido.');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('academy_curso_modulos').select('id, posicao, titulo').eq('curso_id', cursoId).order('posicao').order('titulo');
  const novas = mover((data ?? []) as Array<{ id: string }>, moduloId, direcao);
  const antigas = new Map(((data ?? []) as Array<{ id: string; posicao: number }>).map((m) => [m.id, m.posicao]));
  await Promise.all(novas.filter((n) => antigas.get(n.id) !== n.posicao).map((n) => sb.schema('agro').from('academy_curso_modulos').update({ posicao: n.posicao }).eq('id', n.id)));
  voltar(cursoId);
}

async function adicionarAulaImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const moduloId = texto(fd, 'modulo_id');
  const conteudoId = texto(fd, 'conteudo_id');
  if (!UUID.test(cursoId) || !UUID.test(moduloId)) throw new ErroDeUsuario('Módulo inválido.');
  if (!UUID.test(conteudoId)) throw new ErroDeUsuario('Escolha o conteúdo que vira aula.');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('academy_curso_aulas').select('posicao').eq('modulo_id', moduloId).order('posicao', { ascending: false }).limit(1);
  const proxima = ((data?.[0]?.posicao as number | undefined) ?? -1) + 1;
  const { error } = await sb.schema('agro').from('academy_curso_aulas').insert({ curso_id: cursoId, modulo_id: moduloId, conteudo_id: conteudoId, posicao: proxima });
  if (error) {
    if (error.code === '23505') throw new ErroDeUsuario('Este conteúdo já é aula deste curso.');
    lancarDoBanco(error);
  }
  voltar(cursoId);
}

async function moverAulaImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const moduloId = texto(fd, 'modulo_id');
  const aulaId = texto(fd, 'aula_id');
  const direcao = texto(fd, 'direcao');
  if (!UUID.test(cursoId) || !UUID.test(moduloId) || !UUID.test(aulaId) || (direcao !== 'subir' && direcao !== 'descer')) throw new ErroDeUsuario('Aula inválida.');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('academy_curso_aulas').select('id, posicao').eq('modulo_id', moduloId).order('posicao');
  const novas = mover((data ?? []) as Array<{ id: string }>, aulaId, direcao);
  const antigas = new Map(((data ?? []) as Array<{ id: string; posicao: number }>).map((a) => [a.id, a.posicao]));
  await Promise.all(novas.filter((n) => antigas.get(n.id) !== n.posicao).map((n) => sb.schema('agro').from('academy_curso_aulas').update({ posicao: n.posicao }).eq('id', n.id)));
  voltar(cursoId);
}

async function removerAulaImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const cursoId = texto(fd, 'curso_id');
  const aulaId = texto(fd, 'aula_id');
  if (!UUID.test(cursoId) || !UUID.test(aulaId)) throw new ErroDeUsuario('Aula inválida.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('academy_curso_aulas').delete().eq('id', aulaId);
  if (error) lancarDoBanco(error);
  voltar(cursoId);
}

export const salvarCurso = comAviso(salvarCursoImpl);
export const excluirCurso = comAviso(excluirCursoImpl);
export const adicionarModulo = comAviso(adicionarModuloImpl);
export const renomearModulo = comAviso(renomearModuloImpl);
export const removerModulo = comAviso(removerModuloImpl);
export const moverModulo = comAviso(moverModuloImpl);
export const adicionarAula = comAviso(adicionarAulaImpl);
export const moverAula = comAviso(moverAulaImpl);
export const removerAula = comAviso(removerAulaImpl);
