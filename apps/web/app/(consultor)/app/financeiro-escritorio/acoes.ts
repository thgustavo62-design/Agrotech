'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
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

const exigirOrg = () => exigir('financeiro');

const CAMINHO = '/app/financeiro-escritorio';

/** Cria um lançamento (receita ou despesa) do escritório, com comprovante opcional. */
async function criarLancamentoEscritorioImpl(fd: FormData) {
  const perfil = await exigirOrg();
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
    const caminho = `${perfil.org_id}/${crypto.randomUUID()}.${ext}`;
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    const { error } = await sb.storage.from('financeiro-escritorio').upload(caminho, buf, {
      contentType: arquivo.type || undefined,
    });
    if (error) throw new ErroDeUsuario('Falha ao enviar o comprovante: ' + error.message);
    comprovante_path = caminho;
  }

  const { error } = await sb.schema('agro').from('financeiro_escrit_lancamentos').insert({
    org_id: perfil.org_id,
    tipo,
    descricao,
    valor,
    data,
    vencimento: txt(fd, 'vencimento'),
    status: txt(fd, 'status') ?? 'pendente',
    conta_id: txt(fd, 'conta_id'),
    categoria_id: txt(fd, 'categoria_id'),
    produtor_id: txt(fd, 'produtor_id'),
    observacao: txt(fd, 'observacao'),
    comprovante_path,
  });
  if (error) lancarDoBanco(error);
  revalidatePath(CAMINHO);
}

async function mudarStatusLancamentoEscritorioImpl(fd: FormData) {
  await exigirOrg();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
    throw new ErroDeUsuario('Dados inválidos.');
  }
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_lancamentos').update({ status }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath(CAMINHO);
}

async function excluirLancamentoEscritorioImpl(fd: FormData) {
  const perfil = await exigirOrg();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new ErroDeUsuario('Lançamento não informado.');
  const sb = await criarClienteServidor();

  const { data: lanc } = await sb.schema('agro').from('financeiro_escrit_lancamentos')
    .select('comprovante_path').eq('id', id).eq('org_id', perfil.org_id).maybeSingle();

  const { error } = await sb.schema('agro').from('financeiro_escrit_lancamentos').delete().eq('id', id);
  if (error) lancarDoBanco(error);

  if (lanc?.comprovante_path) {
    await sb.storage.from('financeiro-escritorio').remove([lanc.comprovante_path]).catch(() => {});
  }
  revalidatePath(CAMINHO);
}

async function criarContaEscritorioImpl(fd: FormData) {
  const perfil = await exigirOrg();
  const nome = txt(fd, 'nome');
  if (!nome) throw new ErroDeUsuario('Informe o nome da conta.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_contas').insert({
    org_id: perfil.org_id,
    nome,
    tipo: txt(fd, 'tipo') ?? 'corrente',
    saldo_inicial: num(fd, 'saldo_inicial') ?? 0,
  });
  if (error) lancarDoBanco(error);
  revalidatePath(CAMINHO);
}

async function criarCategoriaEscritorioImpl(fd: FormData) {
  const perfil = await exigirOrg();
  const nome = txt(fd, 'nome');
  const tipo = String(fd.get('tipo') ?? '');
  if (!nome) throw new ErroDeUsuario('Informe o nome da categoria.');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new ErroDeUsuario('Selecione receita ou despesa.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_categorias').insert({
    org_id: perfil.org_id,
    nome,
    tipo,
  });
  if (error) lancarDoBanco(error);
  revalidatePath(CAMINHO);
}

export const criarLancamentoEscritorio = comAviso(criarLancamentoEscritorioImpl);
export const mudarStatusLancamentoEscritorio = comAviso(mudarStatusLancamentoEscritorioImpl);
export const excluirLancamentoEscritorio = comAviso(excluirLancamentoEscritorioImpl);
export const criarContaEscritorio = comAviso(criarContaEscritorioImpl);
export const criarCategoriaEscritorio = comAviso(criarCategoriaEscritorioImpl);
