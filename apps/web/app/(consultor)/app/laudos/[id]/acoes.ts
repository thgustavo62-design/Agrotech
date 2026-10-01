'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';
import { hojeISO } from '@/lib/formato';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

const num = (fd: FormData, k: string): number | null => {
  const v = String(fd.get(k) ?? '').trim().replace(',', '.');
  if (v === '') return null;
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : null;
};

/** Confirma a conferência: os valores no formulário (extraídos ou corrigidos
 * à mão) viram uma análise de origem 'pdf', ligada ao talhão escolhido. */
async function confirmarLaudoImpl(fd: FormData) {
  const documento_id = String(fd.get('documento_id') ?? '');
  const talhao_id = String(fd.get('talhao_id') ?? '');
  if (!documento_id) throw new ErroDeUsuario('documento não informado');
  if (!talhao_id) throw new ErroDeUsuario('Selecione o talhão desta amostra.');

  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();

  const dados = {
    talhao_id,
    documento_id,
    origem: 'pdf' as const,
    data_coleta: String(fd.get('data_coleta') ?? '') || hojeISO(),
    profundidade: String(fd.get('profundidade') ?? '') || '0-20',
    laboratorio: String(fd.get('laboratorio') ?? '') || null,
    argila: num(fd, 'argila'), ph: num(fd, 'ph'), mo: num(fd, 'mo'),
    p: num(fd, 'p'), k: num(fd, 'k'), na: num(fd, 'na'),
    ca: num(fd, 'ca'), mg: num(fd, 'mg'), al: num(fd, 'al'), h_al: num(fd, 'h_al'),
    s: num(fd, 's'), b: num(fd, 'b'), zn: num(fd, 'zn'),
    cu: num(fd, 'cu'), mn: num(fd, 'mn'), fe: num(fd, 'fe'),
    prnt: num(fd, 'prnt') ?? 85,
    incorporacao: num(fd, 'incorporacao') ?? 20,
  };

  // laudo com várias amostras (tabela por colunas): cada confirmação vira uma análise
  const total = Math.max(1, Math.trunc(num(fd, 'total_amostras') ?? 1));
  const indice = total > 1 ? Math.trunc(num(fd, 'amostra_indice') ?? 0) : null;
  if (total > 1 && (!indice || indice < 1 || indice > total)) throw new ErroDeUsuario('Amostra inválida.');

  const { data: analise, error } = await sb.schema('agro').from('analises')
    .insert({ ...dados, amostra_indice: indice }).select('id').single();
  if (error?.code === '23505') throw new ErroDeUsuario(`A amostra ${indice} deste laudo já foi confirmada.`);
  if (error) lancarDoBanco(error);

  let faltam = 0;
  if (total > 1) {
    const { count } = await sb.schema('agro').from('analises')
      .select('id', { count: 'exact', head: true }).eq('documento_id', documento_id);
    faltam = Math.max(0, total - (count ?? 0));
  }
  if (faltam === 0) {
    await sb.schema('agro').from('documentos').update({ status: 'confirmado' }).eq('id', documento_id);
  }

  await registrar(sb, {
    acao: 'laudo.confirmado',
    entidade: 'analises',
    entidade_id: analise.id,
    org_id: perfil?.org_id ?? null,
    dados: { documento_id, talhao_id, amostra_indice: indice, total_amostras: total },
  });

  // ainda há amostras: volta à conferência para a próxima; senão abre a análise
  redirect(faltam > 0 ? `/app/laudos/${documento_id}` : `/app/analises/${analise.id}`);
}

/** Descarta um laudo que não deu certo (duplicado, ilegível, amostra errada). */
async function descartarLaudoImpl(fd: FormData) {
  const documento_id = String(fd.get('documento_id') ?? '');
  if (!documento_id) throw new ErroDeUsuario('documento não informado');

  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();

  const { data: doc } = await sb.schema('agro').from('documentos')
    .select('storage_path').eq('id', documento_id).single();
  if (doc?.storage_path) await sb.storage.from('laudos').remove([doc.storage_path as string]);

  await sb.schema('agro').from('documentos').delete().eq('id', documento_id);

  await registrar(sb, {
    acao: 'laudo.descartado', entidade: 'documentos', entidade_id: documento_id,
    org_id: perfil?.org_id ?? null,
  });

  redirect('/app/laudos');
}

export const confirmarLaudo = comAviso(confirmarLaudoImpl);
export const descartarLaudo = comAviso(descartarLaudoImpl);
