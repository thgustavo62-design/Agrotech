'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';

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
  if (!produtor) throw new Error('Sessão sem produtor associado.');
  return produtor;
}

/** Cria um lançamento (receita ou despesa), com comprovante opcional. */
export async function criarLancamento(fd: FormData) {
  const produtor = await exigirProdutor();
  const tipo = String(fd.get('tipo') ?? '');
  const descricao = txt(fd, 'descricao');
  const valor = num(fd, 'valor');
  const data = txt(fd, 'data');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new Error('Selecione receita ou despesa.');
  if (!descricao) throw new Error('Descreva o lançamento.');
  if (valor == null || valor < 0) throw new Error('Informe um valor válido.');
  if (!data) throw new Error('Informe a data.');

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
    if (error) throw new Error('Falha ao enviar o comprovante: ' + error.message);
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
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

/** Muda o status de um lançamento (pago / pendente / cancelado). */
export async function mudarStatusLancamento(fd: FormData) {
  await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
    throw new Error('Dados inválidos.');
  }
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_lancamentos').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

export async function excluirLancamento(fd: FormData) {
  const produtor = await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Lançamento não informado.');
  const sb = await criarClienteServidor();

  const { data: lanc } = await sb.schema('agro').from('financeiro_lancamentos')
    .select('comprovante_path').eq('id', id).eq('produtor_id', produtor.id).maybeSingle();

  const { error } = await sb.schema('agro').from('financeiro_lancamentos').delete().eq('id', id);
  if (error) throw new Error(error.message);

  if (lanc?.comprovante_path) {
    await sb.storage.from('financeiro').remove([lanc.comprovante_path]).catch(() => {});
  }
  revalidatePath('/produtor/financeiro');
}

export async function criarConta(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  if (!nome) throw new Error('Informe o nome da conta.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_contas').insert({
    produtor_id: produtor.id,
    nome,
    tipo: txt(fd, 'tipo') ?? 'corrente',
    saldo_inicial: num(fd, 'saldo_inicial') ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

export async function criarCategoria(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  const tipo = String(fd.get('tipo') ?? '');
  if (!nome) throw new Error('Informe o nome da categoria.');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new Error('Selecione receita ou despesa.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_categorias').insert({
    produtor_id: produtor.id,
    nome,
    tipo,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

export async function criarCentroCusto(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  if (!nome) throw new Error('Informe o nome do centro de custo.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_centros_custo').insert({
    produtor_id: produtor.id,
    nome,
    propriedade_id: txt(fd, 'propriedade_id'),
    talhao_id: txt(fd, 'talhao_id'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

export async function criarOrcamento(fd: FormData) {
  const produtor = await exigirProdutor();
  const categoria_id = txt(fd, 'categoria_id');
  const valor_planejado = num(fd, 'valor_planejado');
  if (!categoria_id) throw new Error('Selecione a categoria.');
  if (valor_planejado == null || valor_planejado <= 0) throw new Error('Informe um valor planejado válido.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_orcamentos').insert({
    produtor_id: produtor.id,
    categoria_id,
    valor_planejado,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}

export async function excluirOrcamento(fd: FormData) {
  await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Orçamento não informado.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_orcamentos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/financeiro');
}
