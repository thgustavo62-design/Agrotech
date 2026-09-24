'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';

const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};

export async function criarEvento(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem organização.');

  const tipo = txt(fd, 'tipo');
  const titulo = txt(fd, 'titulo');
  const data = txt(fd, 'data');
  if (!tipo || !titulo || !data) throw new Error('Tipo, título e data são obrigatórios.');

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('agenda_eventos').insert({
    org_id: perfil.org_id,
    consultor_id: perfil.id,
    tipo,
    titulo,
    data,
    hora: txt(fd, 'hora'),
    produtor_id: txt(fd, 'produtor_id'),
    talhao_id: txt(fd, 'talhao_id'),
    observacao: txt(fd, 'observacao'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/agenda');
}

export async function mudarStatusEvento(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['planejado', 'concluido', 'cancelado'].includes(status)) throw new Error('Dados inválidos.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('agenda_eventos').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/app/agenda');
}
