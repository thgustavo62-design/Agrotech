'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim().replace(',', '.');
  if (v === '') return null;
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : null;
};

async function exigirProdutor() {
  const produtor = await produtorAtual();
  if (!produtor) throw new ErroDeUsuario('Sessão sem produtor associado.');
  return produtor;
}

/** Cria um lançamento (receita ou despesa), com comprovante opcional. */
async function criarLancamentoImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const tipo = String(fd.get('tipo') ?? '');
  const descricao = txt(fd, 'descricao');
  const valor = num(fd, 'valor');
  const data = txt(fd, 'data');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new ErroDeUsuario('Selecione receita ou despesa.');
  if (!descricao) throw new ErroDeUsuario('Descreva o lançamento.');
  if (valor == null || valor < 0) throw new ErroDeUsuario('Informe um valor válido.');
  if (!data) throw new ErroDeUsuario('Informe a data.');

  const sb = await criarClienteServidor();

  let comprovante_path: string | null = null;
  const arquivo = fd.get('comprovante');
  if (arquivo instanceof File && arquivo.size > 0) {
    const ext = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'bin';
    const caminho = `${produtor.id}/${crypto.randomUUID()}.${ext}`;
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    const { error } = await sb.storage.from('financeiro').upload(caminho, buf, {
      contentType: arquivo.type || undefined,
    });
    if (error) throw new ErroDeUsuario('Falha ao enviar o comprovante: ' + error.message);
    comprovante_path = caminho;
  }

  const { error } = await sb.schema('agro').from('financeiro_lancamentos').insert({
    produtor_id: produtor.id,
    tipo,
    descricao,
    valor,
    data,
    vencimento: txt(fd, 'vencimento'),
    status: txt(fd, 'status') ?? 'pendente',
    conta_id: txt(fd, 'conta_id'),
    categoria_id: txt(fd, 'categoria_id'),
    propriedade_id: txt(fd, 'propriedade_id'),
    talhao_id: txt(fd, 'talhao_id'),
    observacao: txt(fd, 'observacao'),
    comprovante_path,
  });
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

/** Muda o status de um lançamento (pago / pendente / cancelado). */
async function mudarStatusLancamentoImpl(fd: FormData) {
  await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
    throw new ErroDeUsuario('Dados inválidos.');
  }
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_lancamentos').update({ status }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

async function excluirLancamentoImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Lançamento não informado.');
  const sb = await criarClienteServidor();

  const { data: lanc } = await sb.schema('agro').from('financeiro_lancamentos')
    .select('comprovante_path').eq('id', id).eq('produtor_id', produtor.id).maybeSingle();

  const { error } = await sb.schema('agro').from('financeiro_lancamentos').delete().eq('id', id);
  if (error) lancarDoBanco(error);

  if (lanc?.comprovante_path) {
    await sb.storage.from('financeiro').remove([lanc.comprovante_path]).catch(() => {});
  }
  revalidatePath('/produtor/financeiro');
}

async function criarContaImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  if (!nome) throw new ErroDeUsuario('Informe o nome da conta.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_contas').insert({
    produtor_id: produtor.id,
    nome,
    tipo: txt(fd, 'tipo') ?? 'corrente',
    saldo_inicial: num(fd, 'saldo_inicial') ?? 0,
  });
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

async function criarCategoriaImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  const tipo = String(fd.get('tipo') ?? '');
  if (!nome) throw new ErroDeUsuario('Informe o nome da categoria.');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new ErroDeUsuario('Selecione receita ou despesa.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_categorias').insert({
    produtor_id: produtor.id,
    nome,
    tipo,
  });
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

async function criarCentroCustoImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  if (!nome) throw new ErroDeUsuario('Informe o nome do centro de custo.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_centros_custo').insert({
    produtor_id: produtor.id,
    nome,
    propriedade_id: txt(fd, 'propriedade_id'),
    talhao_id: txt(fd, 'talhao_id'),
  });
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

async function criarOrcamentoImpl(fd: FormData) {
  const produtor = await exigirProdutor();
  const categoria_id = txt(fd, 'categoria_id');
  const valor_planejado = num(fd, 'valor_planejado');
  if (!categoria_id) throw new ErroDeUsuario('Selecione a categoria.');
  if (valor_planejado == null || valor_planejado <= 0) throw new ErroDeUsuario('Informe um valor planejado válido.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_orcamentos').insert({
    produtor_id: produtor.id,
    categoria_id,
    valor_planejado,
  });
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

async function excluirOrcamentoImpl(fd: FormData) {
  await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Orçamento não informado.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_orcamentos').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath('/produtor/financeiro');
}

export const criarLancamento = comAviso(criarLancamentoImpl);
export const mudarStatusLancamento = comAviso(mudarStatusLancamentoImpl);
export const excluirLancamento = comAviso(excluirLancamentoImpl);
export const criarConta = comAviso(criarContaImpl);
export const criarCategoria = comAviso(criarCategoriaImpl);
export const criarCentroCusto = comAviso(criarCentroCustoImpl);
export const criarOrcamento = comAviso(criarOrcamentoImpl);
export const excluirOrcamento = comAviso(excluirOrcamentoImpl);
