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

export async function criarSafra(fd: FormData) {
  const produtor = await exigirProdutor();
  const nome = txt(fd, 'nome');
  if (!nome) throw new Error('Informe o nome da safra.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('safras').insert({
    produtor_id: produtor.id,
    nome,
    inicio: txt(fd, 'inicio'),
    fim: txt(fd, 'fim'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/producao');
}

export async function criarProducao(fd: FormData) {
  const produtor = await exigirProdutor();
  const talhao_id = txt(fd, 'talhao_id');
  if (!talhao_id) throw new Error('Selecione o talhão.');
  const sb = await criarClienteServidor();

  const { data: talhao } = await sb.schema('agro').from('talhoes')
    .select('cultura, area_ha').eq('id', talhao_id).maybeSingle();

  const producaoRealizada = num(fd, 'producao_realizada');
  const precoMedio = num(fd, 'preco_medio');
  const receitaInformada = num(fd, 'receita_obtida');
  const receita = receitaInformada ?? (producaoRealizada != null && precoMedio != null ? producaoRealizada * precoMedio : null);

  const { error } = await sb.schema('agro').from('producao_registros').insert({
    produtor_id: produtor.id,
    talhao_id,
    safra_id: txt(fd, 'safra_id'),
    cultura: talhao?.cultura ?? null,
    area_ha: num(fd, 'area_ha') ?? talhao?.area_ha ?? null,
    producao_prevista: num(fd, 'producao_prevista'),
    producao_realizada: producaoRealizada,
    unidade: txt(fd, 'unidade') ?? 'sc',
    preco_medio: precoMedio,
    receita_obtida: receita,
    observacao: txt(fd, 'observacao'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/producao');
}

export async function excluirProducao(fd: FormData) {
  await exigirProdutor();
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Registro não informado.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('producao_registros').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/producao');
}
