'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
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

  const falhas = await enviarFotos(sb, perfil?.org_id ?? null, visita.id as string, fd);

  revalidatePath(`/app/talhoes/${talhao_id}`);
  if (falhas > 0) throw new Error(`Visita salva, mas ${falhas} foto(s) não foram enviadas. Abra o talhão e confira.`);
}

const MAX_FOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSAO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Número finito dentro da faixa, arredondado a 6 casas (numeric(10,6)); senão null. */
function coord(fd: FormData, k: string, limite: number): number | null {
  const bruto = String(fd.get(k) ?? '').trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isFinite(n) && Math.abs(n) <= limite ? Math.round(n * 1e6) / 1e6 : null;
}

/** Sobe as fotos da visita para visitas/{org_id}/{visita_id}/ e registra em visita_fotos.
 *  A visita já está gravada: foto que falha não a desfaz, só é contada. */
async function enviarFotos(sb: SupabaseClient, orgId: string | null, visitaId: string, fd: FormData): Promise<number> {
  const arquivos = fd.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return 0;
  if (!orgId) return arquivos.length;

  const legenda = txt(fd, 'legenda_fotos');
  const lat = coord(fd, 'lat', 90);
  const lng = coord(fd, 'lng', 180);
  let falhas = Math.max(0, arquivos.length - MAX_FOTOS);

  for (const arq of arquivos.slice(0, MAX_FOTOS)) {
    const ext = EXTENSAO[arq.type];
    if (!ext || arq.size > MAX_BYTES) { falhas++; continue; }

    const caminho = `${orgId}/${visitaId}/${crypto.randomUUID()}.${ext}`;
    const { error: eUp } = await sb.storage.from('visitas').upload(caminho, arq, { contentType: arq.type });
    if (eUp) { falhas++; continue; }

    const { error: eFoto } = await sb.schema('agro').from('visita_fotos')
      .insert({ visita_id: visitaId, storage_path: caminho, legenda, lat, lng });
    if (eFoto) {
      await sb.storage.from('visitas').remove([caminho]);
      falhas++;
    }
  }
  return falhas;
}
