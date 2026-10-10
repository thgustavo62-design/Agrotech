import { fichaPorSlug } from './atlas-base';

/**
 * Indicação de uma ficha do Atlas a um produtor (migração 0051). A ficha é indicada pelo `slug` (fichas-base, que moram no
 * código) ou pelo `id` (fichas do escritório, que moram no banco). O banco decide o que é segurança; aqui ficam a leitura da
 * referência e as mensagens em linguagem de gente.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReferenciaDeFicha =
  | { tipo: 'base'; slug: string; nome: string }
  | { tipo: 'escritorio'; id: string };

/** "broca-do-cafe" → ficha-base; um UUID → ficha do escritório; qualquer outra coisa → null. */
export function lerReferenciaDeFicha(valor: string): ReferenciaDeFicha | null {
  const v = valor.trim();
  const base = fichaPorSlug(v);
  if (base) return { tipo: 'base', slug: base.slug, nome: base.nome };
  if (UUID.test(v)) return { tipo: 'escritorio', id: v.toLowerCase() };
  return null;
}

export type ResultadoIndicacao =
  | { ok: true; ficha: ReferenciaDeFicha; produtorId: string; mensagem: string | null; visitaId: string | null; analiseId: string | null }
  | { ok: false; erro: string };

export function validarIndicacao(e: { ficha: string; produtorId: string; mensagem: string; visitaId?: string; analiseId?: string }): ResultadoIndicacao {
  const ficha = lerReferenciaDeFicha(e.ficha);
  if (!ficha) return { ok: false, erro: 'Ficha inválida.' };
  if (!UUID.test(e.produtorId.trim())) return { ok: false, erro: 'Escolha o produtor.' };
  const mensagem = e.mensagem.trim();
  if (mensagem.length > 600) return { ok: false, erro: 'O recado passa de 600 letras. Encurte.' };
  const contexto = (v: string | undefined, rotulo: string): { ok: true; v: string | null } | { ok: false; erro: string } => {
    const t = (v ?? '').trim();
    if (!t) return { ok: true, v: null };
    return UUID.test(t) ? { ok: true, v: t.toLowerCase() } : { ok: false, erro: `${rotulo} inválida.` };
  };
  const visita = contexto(e.visitaId, 'Visita');
  if (!visita.ok) return visita;
  const analise = contexto(e.analiseId, 'Análise');
  if (!analise.ok) return analise;
  return { ok: true, ficha, produtorId: e.produtorId.trim().toLowerCase(), mensagem: mensagem || null, visitaId: visita.v, analiseId: analise.v };
}

export interface IndicacaoDeFicha {
  id: string;
  produtor_id: string;
  ficha_id: string | null;
  ficha_slug: string | null;
  titulo: string;
  mensagem: string | null;
  criado_em: string;
  aberto_em: string | null;
}

/** Chave que liga a indicação à ficha na tela: o slug (base) ou o id (escritório). */
export const chaveDaIndicacao = (i: Pick<IndicacaoDeFicha, 'ficha_id' | 'ficha_slug'>): string => i.ficha_slug ?? i.ficha_id ?? '';

export interface ContextoDeIndicacao { produtorId: string; visitaId: string | null; analiseId: string | null }

/**
 * Contexto que vem de outra tela (visita, análise ou o cadastro do produtor) quando o agrônomo clica em "Indicar ficha": o Atlas
 * abre com o produtor já escolhido e a indicação sai ligada à visita/análise. Só vale com ids no formato de UUID.
 */
export function lerContextoDeIndicacao(sp: { indicar?: string; visita?: string; analise?: string }): ContextoDeIndicacao | null {
  const uuid = (v: string | undefined) => (v && UUID.test(v.trim()) ? v.trim().toLowerCase() : null);
  const produtorId = uuid(sp.indicar);
  if (!produtorId) return null;
  return { produtorId, visitaId: uuid(sp.visita), analiseId: uuid(sp.analise) };
}

/** A parte "?indicar=…&visita=…" que acompanha os links do Atlas enquanto a pessoa escolhe a ficha ("" sem contexto). */
export function consultaDoContexto(c: ContextoDeIndicacao | null): string {
  if (!c) return '';
  const q = new URLSearchParams({ indicar: c.produtorId });
  if (c.visitaId) q.set('visita', c.visitaId);
  if (c.analiseId) q.set('analise', c.analiseId);
  return q.toString();
}

/** Link do botão "Indicar ficha" nas telas de visita, análise e produtor. null se o produtor não for um id válido. */
export function linkIndicarFicha(o: { produtorId?: string | null; visitaId?: string | null; analiseId?: string | null }): string | null {
  const c = lerContextoDeIndicacao({ indicar: o.produtorId ?? undefined, visita: o.visitaId ?? undefined, analise: o.analiseId ?? undefined });
  return c ? `/academy/atlas?${consultaDoContexto(c)}` : null;
}
