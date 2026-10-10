'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { validarIndicacao } from '@/lib/atlas-indicacoes';

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Indica uma ficha do Atlas a um produtor (opcionalmente a partir de uma visita ou análise). Quem pode e o que pode ser indicado
 * (ficha publicada do mesmo escritório; produtor do mesmo escritório) o banco confere (0051).
 */
async function indicarFichaImpl(fd: FormData) {
  const perfil = await exigir('academy.indicar');
  const v = validarIndicacao({
    ficha: texto(fd, 'ficha'), produtorId: texto(fd, 'produtor_id'), mensagem: texto(fd, 'mensagem'),
    visitaId: texto(fd, 'visita_id'), analiseId: texto(fd, 'analise_id'),
  });
  if (!v.ok) throw new ErroDeUsuario(v.erro);

  const sb = await criarClienteServidor();
  const linha: Record<string, unknown> = {
    produtor_id: v.produtorId,
    mensagem: v.mensagem,
    visita_id: v.visitaId,
    analise_id: v.analiseId,
    ...(v.ficha.tipo === 'base'
      ? { ficha_slug: v.ficha.slug, titulo: v.ficha.nome }
      // o título de uma ficha do escritório é gravado pelo banco, a partir da própria ficha
      : { ficha_id: v.ficha.id, titulo: 'ficha do escritório' }),
  };
  const { error } = await sb.schema('agro').from('atlas_indicacoes').insert(linha);
  if (error) lancarDoBanco(error);

  const ref = v.ficha.tipo === 'base' ? v.ficha.slug : v.ficha.id;
  await registrar(sb, { org_id: perfil.org_id, acao: 'academy.atlas_indicada', entidade: 'atlas_indicacoes', entidade_id: ref, dados: { produtor_id: v.produtorId } });
  revalidatePath(`/academy/atlas/${ref}`);
  redirect(`/academy/atlas/${ref}?indicado=1`);
}

/** Desfaz uma indicação (o produtor deixa de vê-la em "Indicadas para você"; a ficha em si segue disponível). */
async function removerIndicacaoImpl(fd: FormData) {
  await exigir('academy.indicar');
  const id = texto(fd, 'id');
  if (!UUID.test(id)) throw new ErroDeUsuario('Indicação inválida.');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('atlas_indicacoes').select('ficha_id, ficha_slug').eq('id', id).maybeSingle();
  if (!data) throw new ErroDeUsuario('Indicação não encontrada.');
  const { error } = await sb.schema('agro').from('atlas_indicacoes').delete().eq('id', id);
  if (error) lancarDoBanco(error);
  const ref = (data as { ficha_id: string | null; ficha_slug: string | null }).ficha_slug ?? (data as { ficha_id: string | null }).ficha_id ?? '';
  revalidatePath(`/academy/atlas/${ref}`);
  redirect(`/academy/atlas/${ref}`);
}

export const indicarFicha = comAviso(indicarFichaImpl);
export const removerIndicacao = comAviso(removerIndicacaoImpl);
