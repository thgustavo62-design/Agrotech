'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};

async function criarEventoImpl(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('Sessão sem organização.');

  const tipo = txt(fd, 'tipo');
  const titulo = txt(fd, 'titulo');
  const data = txt(fd, 'data');
  if (!tipo || !titulo || !data) throw new ErroDeUsuario('Tipo, título e data são obrigatórios.');

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
  if (error) lancarDoBanco(error);
  revalidatePath('/app/agenda');
}

async function mudarStatusEventoImpl(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!id || !['planejado', 'concluido', 'cancelado'].includes(status)) throw new ErroDeUsuario('Dados inválidos.');
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('agenda_eventos').update({ status }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath('/app/agenda');
}

/** Arrastar um evento pra outra coluna do kanban — só muda a data. */
async function moverEventoImpl(id: string, novaData: string) {
  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('agenda_eventos').update({ data: novaData }).eq('id', id);
  if (error) lancarDoBanco(error);
  revalidatePath('/app/agenda');
}

export const criarEvento = comAviso(criarEventoImpl);
export const mudarStatusEvento = comAviso(mudarStatusEventoImpl);
export const moverEvento = comAviso(moverEventoImpl);
