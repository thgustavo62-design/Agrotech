'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';

const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};

/**
 * Registrar visita — fecha o débito técnico #4 do audit (não existia
 * formulário nenhum pra criar uma linha em agro.visitas, só leitura).
 * Até 3 ocorrências fixas no mesmo form (sem lista dinâmica — simplificação
 * documentada em PROGRESSO.md; a maioria das visitas registra poucos alvos).
 */
export async function registrarVisita(fd: FormData) {
  const talhao_id = String(fd.get('talhao_id') ?? '');
  const data = txt(fd, 'data');
  if (!talhao_id || !data) throw new Error('Talhão e data são obrigatórios.');

  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();

  const { data: visita, error } = await sb.schema('agro').from('visitas').insert({
    talhao_id,
    consultor_id: perfil?.id ?? null,
    data,
    fenologia: txt(fd, 'fenologia'),
    condicao: txt(fd, 'condicao'),
    observacoes: txt(fd, 'observacoes'),
    recomendacao: txt(fd, 'recomendacao'),
    proxima_visita: txt(fd, 'proxima_visita'),
  }).select('id').single();
  if (error) throw new Error(error.message);

  const ocorrencias = [1, 2, 3]
    .map((i) => ({ alvo: txt(fd, `oc${i}_alvo`), valor: txt(fd, `oc${i}_valor`), acima_nivel: fd.get(`oc${i}_acima`) === 'on' }))
    .filter((o) => o.alvo);

  if (ocorrencias.length > 0) {
    const { error: eOc } = await sb.schema('agro').from('visita_ocorrencias').insert(
      ocorrencias.map((o) => ({ visita_id: visita.id, alvo: o.alvo, valor: o.valor, acima_nivel: o.acima_nivel })),
    );
    if (eOc) throw new Error(eOc.message);
  }

  revalidatePath(`/app/talhoes/${talhao_id}`);
}
