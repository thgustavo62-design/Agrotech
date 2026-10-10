import type { SupabaseClient } from '@supabase/supabase-js';
import type { FichaAtlas } from './atlas-base';
import { idsDeFichasNoTexto } from './atlas';
import { paraFichaAtlas, type FichaDoBanco } from './atlas-escritorio';

/** Leituras do Atlas do escritório (a RLS decide o que cada pessoa vê: o produtor só recebe ficha publicada). */

export interface FotoDaFicha { id: string; storage_path: string; legenda: string | null; posicao: number }

const UMA_HORA = 3600;
const COLUNAS = 'id, tipo, nome, cientifico, outros_nomes, cultura, partes, importancia_campo, importancia_viveiro, sobre, favorecem, manejo, monitoramento, confunde, fonte, url, status, publicado_em, atualizado_em';

async function assinar(sb: SupabaseClient, caminhos: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (caminhos.length === 0) return urls;
  const { data } = await sb.storage.from('academy').createSignedUrls(caminhos, UMA_HORA);
  for (const a of data ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  return urls;
}

/** As fichas PUBLICADAS do escritório, no formato do Atlas, só com a primeira foto assinada (basta para o cartão). */
export async function carregarFichasPublicadas(sb: SupabaseClient): Promise<FichaAtlas[]> {
  const s = sb.schema('agro');
  const { data } = await s.from('atlas_fichas').select(COLUNAS).eq('status', 'publicado').order('nome').limit(500);
  const fichas = (data ?? []) as unknown as FichaDoBanco[];
  if (fichas.length === 0) return [];
  const { data: fotos } = await s.from('atlas_fotos').select('ficha_id, storage_path, posicao').in('ficha_id', fichas.map((f) => f.id)).order('posicao').limit(4000);
  const porFicha = new Map<string, string[]>();
  for (const f of (fotos ?? []) as Array<{ ficha_id: string; storage_path: string }>) porFicha.set(f.ficha_id, [...(porFicha.get(f.ficha_id) ?? []), f.storage_path]);
  const primeiras = fichas.map((f) => porFicha.get(f.id)?.[0]).filter((p): p is string => Boolean(p));
  const urls = await assinar(sb, primeiras);
  return fichas.map((f) => {
    const caminhos = porFicha.get(f.id) ?? [];
    const primeira = caminhos[0] ? urls.get(caminhos[0]) : undefined;
    return paraFichaAtlas(f, primeira ? [primeira] : [], caminhos.length);
  });
}

export interface FichaCompleta { ficha: FichaAtlas; bruta: FichaDoBanco; fotos: Array<FotoDaFicha & { url: string | null }> }

/** Uma ficha do escritório com todas as fotos assinadas (a equipe também recebe rascunho e arquivada). null se não existir/for invisível. */
export async function carregarFichaCompleta(sb: SupabaseClient, id: string): Promise<FichaCompleta | null> {
  const s = sb.schema('agro');
  const { data } = await s.from('atlas_fichas').select(COLUNAS).eq('id', id).maybeSingle();
  if (!data) return null;
  const bruta = data as unknown as FichaDoBanco;
  const { data: fotos } = await s.from('atlas_fotos').select('id, storage_path, legenda, posicao').eq('ficha_id', id).order('posicao').order('criado_em');
  const lista = (fotos ?? []) as FotoDaFicha[];
  const urls = await assinar(sb, lista.map((f) => f.storage_path));
  const comUrl = lista.map((f) => ({ ...f, url: urls.get(f.storage_path) ?? null }));
  const ficha = paraFichaAtlas(bruta, comUrl.map((f) => f.url).filter((u): u is string => Boolean(u)), lista.length);
  return { ficha, bruta, fotos: comUrl };
}

/** nomes das fichas do escritório citadas em textos (id → nome), para a conversa mostrar o link com o nome. */
export async function nomesDeFichas(sb: SupabaseClient, textos: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(textos.flatMap((t) => idsDeFichasNoTexto(t)))].slice(0, 50);
  const nomes = new Map<string, string>();
  if (ids.length === 0) return nomes;
  const { data } = await sb.schema('agro').from('atlas_fichas').select('id, nome').in('id', ids);
  for (const r of (data ?? []) as Array<{ id: string; nome: string }>) nomes.set(r.id.toLowerCase(), r.nome);
  return nomes;
}

/** Fichas do escritório para o Estúdio (todas as situações), com a contagem de fotos. */
export async function listarFichasDoEstudio(sb: SupabaseClient): Promise<Array<FichaDoBanco & { n_fotos: number }>> {
  const s = sb.schema('agro');
  const { data } = await s.from('atlas_fichas').select(COLUNAS).order('atualizado_em', { ascending: false }).limit(500);
  const fichas = (data ?? []) as unknown as FichaDoBanco[];
  if (fichas.length === 0) return [];
  const { data: fotos } = await s.from('atlas_fotos').select('ficha_id').in('ficha_id', fichas.map((f) => f.id)).limit(4000);
  const cont = new Map<string, number>();
  for (const f of (fotos ?? []) as Array<{ ficha_id: string }>) cont.set(f.ficha_id, (cont.get(f.ficha_id) ?? 0) + 1);
  return fichas.map((f) => ({ ...f, n_fotos: cont.get(f.id) ?? 0 }));
}
