'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

async function marcarNotificacaoLidaImpl(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const voltar = String(fd.get('voltar') ?? '/app/notificacoes');
  if (!id) throw new ErroDeUsuario('Notificação não informada.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('notificacoes').update({ lida_em: new Date().toISOString() }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath(voltar);
}

async function marcarTodasLidasImpl(fd: FormData) {
  const voltar = String(fd.get('voltar') ?? '/app/notificacoes');
  const sb = await criarClienteServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new ErroDeUsuario('Sessão inválida.');
  const { error } = await sb.schema('agro').from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('destinatario_user_id', user.id)
    .is('lida_em', null);
  if (error) lancarDoBanco(error);
  revalidatePath(voltar);
}

export const marcarNotificacaoLida = comAviso(marcarNotificacaoLidaImpl);
export const marcarTodasLidas = comAviso(marcarTodasLidasImpl);
