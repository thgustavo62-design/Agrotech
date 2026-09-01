'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

/** Cria ou edita um produtor. `id` vazio = novo. */
export async function salvarProdutor(fd: FormData) {
  const id = txt(fd, 'id');
  const nome = txt(fd, 'nome');
  if (!nome) throw new Error('Informe o nome do produtor.');

  const sb = await criarClienteServidor();
  const dados = {
    nome,
    cpf_cnpj: txt(fd, 'cpf_cnpj'),
    email: txt(fd, 'email'),
    fone: txt(fd, 'fone'),
  };

  if (id) {
    const { error } = await sb.schema('agro').from('produtores').update(dados).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath(`/app/produtores/${id}`);
    redirect(`/app/produtores/${id}`);
  }

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem organização.');
  const { data, error } = await sb
    .schema('agro').from('produtores')
    .insert({ ...dados, org_id: perfil.org_id, origem: 'manual' })
    .select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/app/produtores/${data.id}`);
}

/** Cria uma propriedade sob um produtor. */
export async function salvarPropriedade(fd: FormData) {
  const produtor_id = txt(fd, 'produtor_id');
  const nome = txt(fd, 'nome');
  if (!produtor_id || !nome) throw new Error('Produtor e nome são obrigatórios.');

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('propriedades').insert({
    produtor_id,
    nome,
    municipio: txt(fd, 'municipio'),
    uf: txt(fd, 'uf') ?? 'ES',
    area_total: num(fd, 'area_total'),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/produtores/${produtor_id}`);
}

/** Cria ou edita um talhão. */
export async function salvarTalhao(fd: FormData) {
  const id = txt(fd, 'id');
  const propriedade_id = txt(fd, 'propriedade_id');
  const nome = txt(fd, 'nome');
  const cultura = txt(fd, 'cultura');
  const produtor_id = txt(fd, 'produtor_id'); // só para revalidar
  if (!nome || !cultura) throw new Error('Nome e cultura são obrigatórios.');

  const sb = await criarClienteServidor();
  const dados = {
    nome,
    cultura,
    variedade: txt(fd, 'variedade'),
    area_ha: num(fd, 'area_ha'),
    prod_esperada: num(fd, 'prod_esperada'),
    espacamento: txt(fd, 'espacamento'),
    ano_implantacao: num(fd, 'ano_implantacao'),
    obs: txt(fd, 'obs'),
  };

  if (id) {
    const { error } = await sb.schema('agro').from('talhoes').update(dados).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    if (!propriedade_id) throw new Error('Selecione a propriedade.');
    const { error } = await sb.schema('agro').from('talhoes').insert({ ...dados, propriedade_id });
    if (error) throw new Error(error.message);
  }
  if (produtor_id) {
    revalidatePath(`/app/produtores/${produtor_id}`);
    redirect(`/app/produtores/${produtor_id}`);
  }
  redirect('/app/talhoes');
}
