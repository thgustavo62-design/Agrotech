import { PADRAO, type TabelasReferencia } from '@agrotech/agro-core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tabelas de referência da organização. Cada escritório tem a própria cópia em
 * `agro.tabelas_referencia` (5 linhas: faixas, fosforo, culturas, fertilizantes,
 * pragas). Enquanto não houver linha para um tipo, cai para o PADRAO do motor.
 */
export async function tabelasDaOrg(sb: SupabaseClient): Promise<TabelasReferencia> {
  const { data } = await sb.schema('agro').from('tabelas_referencia').select('tipo, conteudo');
  const linhas = (data ?? []) as Array<{ tipo: string; conteudo: unknown }>;
  if (linhas.length === 0) return PADRAO;

  const porTipo = new Map(linhas.map((l) => [l.tipo, l.conteudo]));
  const pega = <K extends keyof TabelasReferencia>(k: K): TabelasReferencia[K] =>
    (porTipo.get(k) as TabelasReferencia[K] | undefined) ?? PADRAO[k];

  return {
    faixas: pega('faixas'),
    fosforo: pega('fosforo'),
    culturas: pega('culturas'),
    fertilizantes: pega('fertilizantes'),
    pragas: pega('pragas'),
  };
}
