'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/lib/supabase/server';

export async function marcarNotificacaoLida(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('Notificação não informada.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('notificacoes').update({ lida_em: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/notificacoes');
}

export async function marcarTodasLidas() {
  const sb = await criarClienteServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Sessão inválida.');
  const { error } = await sb.schema('agro').from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('destinatario_user_id', user.id)
    .is('lida_em', null);
  if (error) throw new Error(error.message);
  revalidatePath('/produtor/notificacoes');
}
