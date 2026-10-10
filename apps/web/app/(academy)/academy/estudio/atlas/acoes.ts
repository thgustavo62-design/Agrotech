'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { tipoDeImagem } from '@/lib/arquivos';
import { nomeSeguroDeArquivo } from '@/lib/academy';
import { MAX_FOTOS_DA_FICHA, validarFicha, type EntradaFicha } from '@/lib/atlas-escritorio';

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES_FOTO = 5 * 1024 * 1024;
const MAX_POR_ENVIO = 5;

type Intencao = 'rascunho' | 'publicar' | 'arquivar' | 'salvar';

/**
 * Cria ou edita uma ficha do Atlas do escritório. `intencao` vem do botão apertado (como nos conteúdos):
 * rascunho · publicar · arquivar · salvar (mantém a situação). O banco impõe o que é segurança (0050): permissão, escritório,
 * autor/revisor, e que publicar exige texto, parte da planta e foto.
 */
async function salvarFichaImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');

  const idEnviado = texto(fd, 'id');
  if (idEnviado && !UUID.test(idEnviado)) throw new ErroDeUsuario('Ficha inválida.');
  const intencao = texto(fd, 'intencao') as Intencao;
  if (!['rascunho', 'publicar', 'arquivar', 'salvar'].includes(intencao)) throw new ErroDeUsuario('Ação inválida.');

  let statusAtual: string | null = null;
  let nFotos = 0;
  if (idEnviado) {
    const { data } = await s.from('atlas_fichas').select('id, status').eq('id', idEnviado).maybeSingle();
    if (!data) throw new ErroDeUsuario('Ficha não encontrada.');
    statusAtual = (data as { status: string }).status;
    const { count } = await s.from('atlas_fotos').select('id', { count: 'exact', head: true }).eq('ficha_id', idEnviado);
    nFotos = count ?? 0;
  }
  const id = idEnviado || crypto.randomUUID();

  const statusFinal =
    intencao === 'publicar' ? 'publicado'
    : intencao === 'arquivar' ? 'arquivado'
    : intencao === 'rascunho' ? 'rascunho'
    : (statusAtual ?? 'rascunho');

  const entrada: EntradaFicha = {
    tipo: texto(fd, 'tipo'), nome: texto(fd, 'nome'), cientifico: texto(fd, 'cientifico'), outros_nomes: texto(fd, 'outros_nomes'),
    cultura: texto(fd, 'cultura'), partes: fd.getAll('partes').map(String), importancia_campo: texto(fd, 'importancia_campo'),
    importancia_viveiro: texto(fd, 'importancia_viveiro'), sobre: texto(fd, 'sobre'), favorecem: texto(fd, 'favorecem'),
    manejo: texto(fd, 'manejo'), monitoramento: texto(fd, 'monitoramento'), confunde: texto(fd, 'confunde'), fonte: texto(fd, 'fonte'), url: texto(fd, 'url'),
  };
  // quem já está publicado e só salva de novo continua exigindo o mesmo que publicar
  const valido = validarFicha(entrada, statusFinal === 'publicado', nFotos > 0);
  if (!valido.ok) throw new ErroDeUsuario(valido.erro);

  const linha = { ...valido.dados, status: statusFinal };
  const { error } = statusAtual
    ? await s.from('atlas_fichas').update(linha).eq('id', id)
    : await s.from('atlas_fichas').insert({ id, org_id: perfil.org_id, ...linha });
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    org_id: perfil.org_id,
    acao: statusAtual ? `academy.atlas_${intencao}` : 'academy.atlas_criada',
    entidade: 'atlas_fichas',
    entidade_id: id,
    dados: { nome: valido.dados.nome, tipo: valido.dados.tipo, status: statusFinal },
  });
  revalidatePath('/academy/estudio/atlas');
  revalidatePath('/academy/atlas');
  redirect(`/academy/estudio/atlas/${id}`);
}

/** Apaga a ficha (e as fotos dela, no banco e no Storage). Para só tirar do ar, use "arquivar". */
async function excluirFichaImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const id = texto(fd, 'id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Ficha inválida.');
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');

  const { data: ficha } = await s.from('atlas_fichas').select('nome').eq('id', id).maybeSingle();
  if (!ficha) throw new ErroDeUsuario('Ficha não encontrada.');
  const { data: fotos } = await s.from('atlas_fotos').select('storage_path').eq('ficha_id', id);
  const caminhos = ((fotos ?? []) as Array<{ storage_path: string }>).map((f) => f.storage_path);

  const { error } = await s.from('atlas_fichas').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  if (caminhos.length > 0) await sb.storage.from('academy').remove(caminhos);

  await registrar(sb, { org_id: perfil.org_id, acao: 'academy.atlas_excluida', entidade: 'atlas_fichas', entidade_id: id, dados: { nome: (ficha as { nome: string }).nome } });
  revalidatePath('/academy/estudio/atlas');
  revalidatePath('/academy/atlas');
  redirect('/academy/estudio/atlas');
}

/** Envia até 5 fotos de uma vez (já reduzidas no navegador). Confere o CONTEÚDO do arquivo, não a extensão. */
async function enviarFotosImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const id = texto(fd, 'ficha_id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Ficha inválida.');
  const arquivos = fd.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) throw new ErroDeUsuario('Escolha pelo menos uma foto.');
  const legenda = texto(fd, 'legenda').trim().slice(0, 200) || null;

  const sb = await criarClienteServidor();
  const s = sb.schema('agro');
  const { data: ficha } = await s.from('atlas_fichas').select('id').eq('id', id).maybeSingle();
  if (!ficha) throw new ErroDeUsuario('Ficha não encontrada.');
  const { count } = await s.from('atlas_fotos').select('id', { count: 'exact', head: true }).eq('ficha_id', id);
  let posicao = count ?? 0;
  if (posicao + Math.min(arquivos.length, MAX_POR_ENVIO) > MAX_FOTOS_DA_FICHA) {
    throw new ErroDeUsuario(`Cada ficha tem no máximo ${MAX_FOTOS_DA_FICHA} fotos (já tem ${posicao}). Remova alguma antes de enviar outra.`);
  }

  let falhas = 0;
  for (const f of arquivos.slice(0, MAX_POR_ENVIO)) {
    if (f.size > MAX_BYTES_FOTO) { falhas++; continue; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const tipo = tipoDeImagem(bytes);
    if (!tipo) { falhas++; continue; }
    const caminho = `${perfil.org_id}/atlas/${id}/${crypto.randomUUID()}-${nomeSeguroDeArquivo(f.name)}`;
    const { error: eUp } = await sb.storage.from('academy').upload(caminho, bytes, { contentType: tipo });
    if (eUp) { falhas++; continue; }
    const { error } = await s.from('atlas_fotos').insert({ ficha_id: id, org_id: perfil.org_id, storage_path: caminho, legenda, posicao: posicao++ });
    if (error) { await sb.storage.from('academy').remove([caminho]); falhas++; }
  }
  revalidatePath(`/academy/estudio/atlas/${id}`);
  if (falhas === arquivos.length) throw new ErroDeUsuario('Não foi possível enviar as fotos. Use JPG, PNG ou WebP de até 5 MB.');
  redirect(`/academy/estudio/atlas/${id}`);
}

/** Remove uma foto (o banco não deixa tirar a última de uma ficha publicada). */
async function removerFotoImpl(fd: FormData) {
  await exigir('academy.gerenciar');
  const fotoId = texto(fd, 'foto_id');
  if (!UUID.test(fotoId)) throw new ErroDeUsuario('Foto inválida.');
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');
  const { data } = await s.from('atlas_fotos').select('ficha_id, storage_path').eq('id', fotoId).maybeSingle();
  if (!data) throw new ErroDeUsuario('Foto não encontrada.');
  const foto = data as { ficha_id: string; storage_path: string };
  const { error } = await s.from('atlas_fotos').delete().eq('id', fotoId);
  if (error) lancarDoBanco(error);
  await sb.storage.from('academy').remove([foto.storage_path]);
  revalidatePath(`/academy/estudio/atlas/${foto.ficha_id}`);
  redirect(`/academy/estudio/atlas/${foto.ficha_id}`);
}

export const salvarFicha = comAviso(salvarFichaImpl);
export const excluirFicha = comAviso(excluirFichaImpl);
export const enviarFotos = comAviso(enviarFotosImpl);
export const removerFoto = comAviso(removerFotoImpl);
