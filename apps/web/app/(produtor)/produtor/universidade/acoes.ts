'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O produtor marca que concluiu um conteúdo que o agrônomo indicou. A hora é a do servidor e o banco só deixa o produtor mexer
 * na abertura e na conclusão das PRÓPRIAS indicações (0046) — quem não recebeu a indicação não consegue concluir nada.
 */
async function concluirConteudoImpl(fd: FormData) {
  const conteudoId = String(fd.get('conteudo_id') ?? '');
  if (!UUID.test(conteudoId)) throw new ErroDeUsuario('Conteúdo inválido.');
  const sb = await criarClienteServidor();
  const { data, error } = await sb.schema('agro').from('academy_indicacoes')
    .update({ concluido_em: new Date().toISOString() })
    .eq('conteudo_id', conteudoId)
    .is('concluido_em', null)
    .select('id');
  if (error) lancarDoBanco(error);
  if (!data || data.length === 0) throw new ErroDeUsuario('Este conteúdo já estava concluído, ou não foi indicado a você.');
  revalidatePath('/produtor/universidade');
  revalidatePath(`/produtor/universidade/${conteudoId}`);
}

export const concluirConteudo = comAviso(concluirConteudoImpl);
