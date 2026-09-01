'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';

const NUM = (fd: FormData, k: string): number | null => {
  const v = String(fd.get(k) ?? '').trim().replace(',', '.');
  if (v === '') return null;
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : null;
};

export async function criarAnalise(fd: FormData) {
  const sb = await criarClienteServidor();

  const talhao_id = String(fd.get('talhao_id') ?? '');
  const data_coleta = String(fd.get('data_coleta') ?? '') || new Date().toISOString().slice(0, 10);
  if (!talhao_id) throw new Error('Selecione um talhão.');

  const { data, error } = await sb
    .schema('agro')
    .from('analises')
    .insert({
      talhao_id,
      data_coleta,
      profundidade: String(fd.get('profundidade') ?? '0-20'),
      laboratorio: String(fd.get('laboratorio') ?? '') || null,
      origem: 'manual',
      argila: NUM(fd, 'argila'), ph: NUM(fd, 'ph'), mo: NUM(fd, 'mo'),
      p: NUM(fd, 'p'), k: NUM(fd, 'k'), na: NUM(fd, 'na'),
      ca: NUM(fd, 'ca'), mg: NUM(fd, 'mg'), al: NUM(fd, 'al'), h_al: NUM(fd, 'h_al'),
      s: NUM(fd, 's'), b: NUM(fd, 'b'), zn: NUM(fd, 'zn'),
      cu: NUM(fd, 'cu'), mn: NUM(fd, 'mn'), fe: NUM(fd, 'fe'),
      prnt: NUM(fd, 'prnt') ?? 85,
      incorporacao: NUM(fd, 'incorporacao') ?? 20,
      prod_esperada: NUM(fd, 'prod_esperada'),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  redirect(`/app/analises/${data.id}`);
}
