'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { ehPdf, tipoDeImagem } from '@/lib/arquivos';
import { MAX_ARQUIVO_ACADEMY, nomeSeguroDeArquivo, validarConteudo, type EntradaConteudo } from '@/lib/academy';

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Intencao = 'rascunho' | 'publicar' | 'arquivar' | 'salvar';
interface ConteudoAtual { id: string; status: string; arquivo_path: string | null }

/**
 * Cria ou edita um conteúdo. `intencao` vem do botão apertado:
 *   rascunho  → guarda (ou volta) como rascunho      publicar → publica (revisão registrada pelo banco)
 *   arquivar  → tira do ar sem apagar                salvar   → mantém a situação atual (um publicado continua publicado)
 * O que é segurança (quem pode, link só https, só publica o que tem o que mostrar) o banco impõe de qualquer jeito (0046).
 */
async function salvarConteudoImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const sb = await criarClienteServidor();

  const idEnviado = texto(fd, 'id');
  if (idEnviado && !UUID.test(idEnviado)) throw new ErroDeUsuario('Conteúdo inválido.');
  const intencao = texto(fd, 'intencao') as Intencao;
  if (!['rascunho', 'publicar', 'arquivar', 'salvar'].includes(intencao)) throw new ErroDeUsuario('Ação inválida.');

  // o que já existe (a RLS só devolve o do próprio escritório)
  let atual: ConteudoAtual | null = null;
  if (idEnviado) {
    const { data } = await sb.schema('agro').from('academy_conteudos').select('id, status, arquivo_path').eq('id', idEnviado).maybeSingle();
    if (!data) throw new ErroDeUsuario('Conteúdo não encontrado.');
    atual = data as ConteudoAtual;
  }
  const id = atual?.id ?? crypto.randomUUID();

  const statusFinal =
    intencao === 'publicar' ? 'publicado'
    : intencao === 'arquivar' ? 'arquivado'
    : intencao === 'rascunho' ? 'rascunho'
    : (atual?.status ?? 'rascunho');
  const vaiFicarPublicado = statusFinal === 'publicado';

  // arquivo novo (PDF ou imagem; confere o CONTEÚDO, não a extensão)
  const enviado = fd.get('arquivo');
  const novoArquivo = enviado instanceof File && enviado.size > 0 ? enviado : null;
  let bytes: Uint8Array | null = null;
  let tipoMime = '';
  if (novoArquivo) {
    if (novoArquivo.size > MAX_ARQUIVO_ACADEMY) throw new ErroDeUsuario('O arquivo passa de 10 MB. Reduza e envie de novo.');
    bytes = new Uint8Array(await novoArquivo.arrayBuffer());
    tipoMime = ehPdf(bytes) ? 'application/pdf' : (tipoDeImagem(bytes) ?? '');
    if (!tipoMime) throw new ErroDeUsuario('Envie um PDF ou uma imagem (JPG, PNG ou WebP).');
  }
  const removerArquivo = texto(fd, 'remover_arquivo') === 'on';
  const manteraArquivo = Boolean(atual?.arquivo_path) && !removerArquivo && !novoArquivo;
  const temArquivo = Boolean(novoArquivo) || manteraArquivo;

  const entrada: EntradaConteudo = {
    tipo: texto(fd, 'tipo'), titulo: texto(fd, 'titulo'), descricao: texto(fd, 'descricao'), cultura: texto(fd, 'cultura'),
    tema: texto(fd, 'tema'), nivel: texto(fd, 'nivel'), duracao_min: texto(fd, 'duracao_min'), url: texto(fd, 'url'),
    corpo: texto(fd, 'corpo'), fonte: texto(fd, 'fonte'), visibilidade: texto(fd, 'visibilidade'),
    data_materia: texto(fd, 'data_materia'), regiao: texto(fd, 'regiao'),
  };
  const valido = validarConteudo(entrada, vaiFicarPublicado, temArquivo);
  if (!valido.ok) throw new ErroDeUsuario(valido.erro);
  const d = valido.dados;
  // só "material" leva arquivo; trocar o tipo não deixa arquivo órfão
  const guardaArquivo = d.tipo === 'material' && temArquivo;

  // produtores escolhidos (só vale com visibilidade "selecionados")
  const escolhidos = [...new Set(fd.getAll('produtor_id').map(String).filter((p) => UUID.test(p)))];
  if (vaiFicarPublicado && d.visibilidade === 'selecionados' && escolhidos.length === 0) {
    throw new ErroDeUsuario('Escolha pelo menos um produtor, ou deixe o conteúdo para todos.');
  }

  // 1) sobe o arquivo (se houver) antes de gravar a linha que aponta para ele
  let caminhoNovo: string | null = null;
  if (novoArquivo && bytes && guardaArquivo) {
    caminhoNovo = `${perfil.org_id}/${id}/${crypto.randomUUID()}-${nomeSeguroDeArquivo(novoArquivo.name)}`;
    const { error: eUp } = await sb.storage.from('academy').upload(caminhoNovo, bytes, { contentType: tipoMime });
    if (eUp) throw new ErroDeUsuario('Não foi possível enviar o arquivo agora. Tente de novo.');
  }
  const arquivoFinal = guardaArquivo ? (caminhoNovo ?? atual?.arquivo_path ?? null) : null;

  // 2) grava
  const linha = { ...d, status: statusFinal, arquivo_path: arquivoFinal };
  const { error } = atual
    ? await sb.schema('agro').from('academy_conteudos').update(linha).eq('id', id)
    : await sb.schema('agro').from('academy_conteudos').insert({ id, org_id: perfil.org_id, ...linha });
  if (error) {
    if (caminhoNovo) await sb.storage.from('academy').remove([caminhoNovo]); // não deixa arquivo solto
    lancarDoBanco(error);
  }

  // 3) quem pode ver
  await sb.schema('agro').from('academy_publicos').delete().eq('conteudo_id', id);
  if (d.visibilidade === 'selecionados' && escolhidos.length > 0) {
    const { error: eP } = await sb.schema('agro').from('academy_publicos')
      .insert(escolhidos.map((produtor_id) => ({ conteudo_id: id, produtor_id })));
    if (eP) lancarDoBanco(eP);
  }

  // 4) arquivo antigo que ficou para trás (trocado, removido ou tipo mudado)
  if (atual?.arquivo_path && atual.arquivo_path !== arquivoFinal) {
    await sb.storage.from('academy').remove([atual.arquivo_path]);
  }

  await registrar(sb, {
    org_id: perfil.org_id,
    acao: atual ? `academy.conteudo_${intencao}` : 'academy.conteudo_criado',
    entidade: 'academy_conteudos',
    entidade_id: id,
    dados: { titulo: d.titulo, tipo: d.tipo, status: statusFinal, visibilidade: d.visibilidade, selecionados: escolhidos.length },
  });

  revalidatePath('/academy/estudio/conteudos');
  redirect(`/academy/estudio/conteudos/${id}`);
}

/** Apaga o conteúdo (e as indicações dele) e o arquivo. Para tirar do ar sem perder nada, use "arquivar". */
async function excluirConteudoImpl(fd: FormData) {
  const perfil = await exigir('academy.gerenciar');
  const id = texto(fd, 'id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Conteúdo inválido.');
  const sb = await criarClienteServidor();

  const { data } = await sb.schema('agro').from('academy_conteudos').select('titulo, arquivo_path').eq('id', id).maybeSingle();
  if (!data) throw new ErroDeUsuario('Conteúdo não encontrado.');
  const { error } = await sb.schema('agro').from('academy_conteudos').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  if (data.arquivo_path) await sb.storage.from('academy').remove([data.arquivo_path as string]);

  await registrar(sb, { org_id: perfil.org_id, acao: 'academy.conteudo_excluido', entidade: 'academy_conteudos', entidade_id: id, dados: { titulo: data.titulo } });
  revalidatePath('/academy/estudio/conteudos');
  redirect('/academy/estudio/conteudos');
}

export const salvarConteudo = comAviso(salvarConteudoImpl);
export const excluirConteudo = comAviso(excluirConteudoImpl);
