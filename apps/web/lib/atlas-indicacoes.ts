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
