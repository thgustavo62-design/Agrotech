'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

/** Cria um link público de resultados para o produtor (cultura opcional). */
export async function criarCompartilhamento(fd: FormData) {
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const culturaRaw = String(fd.get('cultura') ?? '').trim();
  const cultura = culturaRaw === '' || culturaRaw === '__todas' ? null : culturaRaw;
  const rotulo = String(fd.get('rotulo') ?? '').trim() || null;
  if (!produtor_id) throw new Error('produtor não informado');

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('sessão inválida');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('compartilhamentos').insert({
    org_id: perfil.org_id,
    produtor_id,
    cultura,
    rotulo,
  }).select('id, token').single();
  if (error) throw new Error(error.message);
  await registrar(sb, {
    acao: 'compartilhamento.criado',
    entidade: 'compartilhamentos',
    entidade_id: data?.id ?? null,
    org_id: perfil.org_id,
    dados: { produtor_id, cultura, rotulo },
  });
  revalidatePath(`/app/produtores/${produtor_id}`);
}

export async function alternarCompartilhamento(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const produtor_id = String(fd.get('produtor_id') ?? '');
  const ativo = String(fd.get('ativo') ?? '') === 'true';
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('compartilhamentos').update({ ativo: !ativo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/produtores/${produtor_id}`);
}
