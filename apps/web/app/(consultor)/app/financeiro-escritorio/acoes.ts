'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';

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

async function exigirOrg() {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem escritório associado.');
  return perfil;
}

const CAMINHO = '/app/financeiro-escritorio';

/** Cria um lançamento (receita ou despesa) do escritório, com comprovante opcional. */
export async function criarLancamentoEscritorio(fd: FormData) {
  const perfil = await exigirOrg();
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
    const caminho = `${perfil.org_id}/${crypto.randomUUID()}.${ext}`;
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    const { error } = await sb.storage.from('financeiro-escritorio').upload(caminho, buf, {
      contentType: arquivo.type || undefined,
    });
    if (error) throw new Error('Falha ao enviar o comprovante: ' + error.message);
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
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function mudarStatusLancamentoEscritorio(fd: FormData) {
  await exigirOrg();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
    throw new Error('Dados inválidos.');
  }
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_lancamentos').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function excluirLancamentoEscritorio(fd: FormData) {
  const perfil = await exigirOrg();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Lançamento não informado.');
  const sb = await criarClienteServidor();

  const { data: lanc } = await sb.schema('agro').from('financeiro_escrit_lancamentos')
    .select('comprovante_path').eq('id', id).eq('org_id', perfil.org_id).maybeSingle();

  const { error } = await sb.schema('agro').from('financeiro_escrit_lancamentos').delete().eq('id', id);
  if (error) throw new Error(error.message);

  if (lanc?.comprovante_path) {
    await sb.storage.from('financeiro-escritorio').remove([lanc.comprovante_path]).catch(() => {});
  }
  revalidatePath(CAMINHO);
}

export async function criarContaEscritorio(fd: FormData) {
  const perfil = await exigirOrg();
  const nome = txt(fd, 'nome');
  if (!nome) throw new Error('Informe o nome da conta.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_contas').insert({
    org_id: perfil.org_id,
    nome,
    tipo: txt(fd, 'tipo') ?? 'corrente',
    saldo_inicial: num(fd, 'saldo_inicial') ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function criarCategoriaEscritorio(fd: FormData) {
  const perfil = await exigirOrg();
  const nome = txt(fd, 'nome');
  const tipo = String(fd.get('tipo') ?? '');
  if (!nome) throw new Error('Informe o nome da categoria.');
  if (tipo !== 'receita' && tipo !== 'despesa') throw new Error('Selecione receita ou despesa.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('financeiro_escrit_categorias').insert({
    org_id: perfil.org_id,
    nome,
    tipo,
  });
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}
