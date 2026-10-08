'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { tipoDeImagem } from '@/lib/arquivos';
import { ehControleDoNext, ErroDeUsuario, lancarDoBanco, MENSAGEM_GENERICA } from '@/lib/acao';
import { chaveDaFoto, classificarFotos, ocorrenciasDoForm } from '@/lib/visita-itens';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehUuid = (v: string) => RE_UUID.test(v);

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
async function registrarVisitaImpl(fd: FormData): Promise<ResultadoVisita> {
  const talhao_id = String(fd.get('talhao_id') ?? '');
  const data = txt(fd, 'data');
  if (!talhao_id || !data) throw new ErroDeUsuario('Talhão e data são obrigatórios.');

  const chaveBruta = txt(fd, 'chave_cliente');
  const chave = chaveBruta && ehUuid(chaveBruta) ? chaveBruta : null;

  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();

  // 1) a visita. Reenvio (mesma chave): o servidor já gravou — em vez de dar o assunto por encerrado, ACHA a visita e
  //    completa o que ficou faltando (ocorrências e fotos), porque a primeira tentativa pode ter parado no meio.
  let visitaId: string;
  const { data: visita, error } = await sb.schema('agro').from('visitas').insert({
    talhao_id,
    consultor_id: perfil?.id ?? null,
    data,
    fenologia: txt(fd, 'fenologia'),
    condicao: txt(fd, 'condicao'),
    observacoes: txt(fd, 'observacoes'),
    recomendacao: txt(fd, 'recomendacao'),
    proxima_visita: txt(fd, 'proxima_visita'),
    chave_cliente: chave,
  }).select('id').single();
  if (error?.code === '23505' && chave) {
    const { data: existente } = await sb.schema('agro').from('visitas').select('id').eq('chave_cliente', chave).maybeSingle();
    if (!existente) throw new ErroDeUsuario('Esta visita já foi registrada por outra conta.');
    visitaId = existente.id as string;
  } else {
    if (error) lancarDoBanco(error);
    visitaId = visita!.id as string;
  }
  // sem chave (envio direto sem fila) as chaves das fotos nascem da própria visita
  const base = chave ?? visitaId;

  // 2) ocorrências, cada uma pela posição no formulário: reenviar não duplica e completa a que faltou
  const ocorrencias = ocorrenciasDoForm(fd);
  let pendentes = 0;
  if (ocorrencias.length > 0) {
    const { error: eOc } = await sb.schema('agro').from('visita_ocorrencias').upsert(
      ocorrencias.map((o) => ({ visita_id: visitaId, indice: o.indice, alvo: o.alvo, valor: o.valor, acima_nivel: o.acima_nivel })),
      { onConflict: 'visita_id,indice', ignoreDuplicates: true },
    );
    if (eOc) { console.error('[registrarVisita] ocorrências', eOc); pendentes += ocorrencias.length; }
  }

  // 3) fotos
  const fotos = await enviarFotos(sb, perfil?.org_id ?? null, visitaId, base, fd);
  pendentes += fotos.pendentes;

  revalidatePath(`/app/talhoes/${talhao_id}`);

  const partes: string[] = [];
  if (fotos.descartadas.length) partes.push(`${fotos.descartadas.length} foto(s) não puderam ser enviadas (${[...new Set(fotos.descartadas)].join('; ')})`);
  if (pendentes > 0) {
    // a visita está gravada, mas faltam partes que podem dar certo depois: o navegador guarda o formulário e reenvia
    return { ok: true, parcial: true, mensagem: `Visita salva, mas ${pendentes} item(ns) (ocorrência/foto) ainda não foram enviados — vou tentar de novo.${partes.length ? ' ' + partes.join('. ') + '.' : ''}` };
  }
  return partes.length ? { ok: true, mensagem: `Visita salva. ${partes.join('. ')}.` } : { ok: true };
}

export type ResultadoVisita = {
  ok: boolean;
  mensagem?: string;
  /** visita gravada, mas faltam partes que ainda podem dar certo: o chamador deve reenviar o MESMO formulário */
  parcial?: boolean;
};

/**
 * Esta ação é chamada direto pelo navegador e pela fila offline, que precisam SABER se deu certo:
 * por isso devolve um resultado em vez de redirecionar com aviso (comAviso) como as demais.
 */
export async function registrarVisita(fd: FormData): Promise<ResultadoVisita> {
  try {
    return await registrarVisitaImpl(fd);
  } catch (e) {
    if (ehControleDoNext(e)) throw e;
    if (e instanceof ErroDeUsuario) return { ok: false, mensagem: e.message };
    console.error('[registrarVisita]', e);
    return { ok: false, mensagem: MENSAGEM_GENERICA };
  }
}

const EXTENSAO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Número finito dentro da faixa, arredondado a 6 casas (numeric(10,6)); senão null. */
function coord(fd: FormData, k: string, limite: number): number | null {
  const bruto = String(fd.get(k) ?? '').trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isFinite(n) && Math.abs(n) <= limite ? Math.round(n * 1e6) / 1e6 : null;
}

/**
 * Sobe as fotos da visita para visitas/{org_id}/{visita_id}/{chave}.ext e registra em visita_fotos.
 * Cada foto tem chave própria (derivada da chave da visita + posição): se já está registrada, pula; se o arquivo já
 * está no armazenamento mas o registro faltou (parou no meio), só registra. Assim reenviar o formulário completa o
 * que falta sem duplicar. `pendentes` = falha que pode passar (rede/armazenamento) → o chamador reenvia;
 * `descartadas` = nunca vai dar certo (grande demais, não é imagem, passou do limite) → não reenviar.
 */
async function enviarFotos(
  sb: SupabaseClient, orgId: string | null, visitaId: string, base: string, fd: FormData,
): Promise<{ pendentes: number; descartadas: string[] }> {
  const arquivos = fd.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0);
  const vazio = { pendentes: 0, descartadas: [] as string[] };
  if (arquivos.length === 0) return vazio;
  if (!orgId) return { pendentes: arquivos.length, descartadas: [] };

  const legenda = txt(fd, 'legenda_fotos');
  const lat = coord(fd, 'lat', 90);
  const lng = coord(fd, 'lng', 180);
  const out = { pendentes: 0, descartadas: [] as string[] };

  const { data: jaFeitas } = await sb.schema('agro').from('visita_fotos').select('chave').eq('visita_id', visitaId);
  const feitas = new Set((jaFeitas ?? []).map((r) => String(r.chave)));

  for (const plano of classificarFotos(arquivos.map((a) => a.size))) {
    if (plano.destino === 'descartar') { out.descartadas.push(plano.motivo); continue; }
    const chave = chaveDaFoto(base, plano.posicao);
    if (feitas.has(chave)) continue; // já está registrada

    const arq = arquivos[plano.posicao]!;
    // o tipo declarado pelo navegador é forjável: vale o conteúdo do arquivo
    const bytes = new Uint8Array(await arq.arrayBuffer());
    const tipo = tipoDeImagem(bytes);
    const ext = tipo ? EXTENSAO[tipo] : undefined;
    if (!tipo || !ext) { out.descartadas.push('arquivo que não é imagem JPG, PNG ou WebP'); continue; }

    const caminho = `${orgId}/${visitaId}/${chave}.${ext}`;
    const { error: eUp } = await sb.storage.from('visitas').upload(caminho, bytes, { contentType: tipo });
    // "já existe": uma tentativa anterior subiu o arquivo e parou antes de registrar — só falta o registro
    if (eUp && !/already exists|duplicate/i.test(eUp.message)) { out.pendentes++; continue; }

    const { error: eFoto } = await sb.schema('agro').from('visita_fotos').upsert(
      { visita_id: visitaId, chave, storage_path: caminho, legenda, lat, lng },
      { onConflict: 'visita_id,chave', ignoreDuplicates: true },
    );
    // o arquivo fica no armazenamento: o reenvio vê "já existe" e só registra (nada de órfão se o próximo passo funcionar)
    if (eFoto) out.pendentes++;
  }
  return out;
}
