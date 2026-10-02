import type { Candidato, FonteTexto } from './tipos.js';

/** Decide o valor de uma célula a partir das várias leituras dela (votação ponderada). */

const rotuloOrigem = (cands: Candidato[], escolhido: Candidato, total: number): string => {
  const iguais = cands.filter((c) => c.valor === escolhido.valor);
  const outras = [...new Set(cands.filter((c) => c.valor !== escolhido.valor).map((c) => c.valor))];
  return `OCR: ${iguais.length} de ${total} leituras${outras.length ? ` (outras: ${outras.join('; ')})` : ''}`;
};

/** Escolhe o valor com mais votos ponderados (limpo > reconstituído > posicional). */
export function votar(cands: Candidato[], totalPassadas: number, fonte: FonteTexto): { valor: number; confianca: number; origem: string } | null {
  if (cands.length === 0) return null;
  const PESO = { limpo: 1, reconstituido: 0.4, posicional: 0.3 } as const;
  const soma = new Map<number, number>();
  for (const c of cands) soma.set(c.valor, (soma.get(c.valor) ?? 0) + PESO[c.peso]);
  const [valor] = [...soma.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const escolhido = cands.filter((c) => c.valor === valor).sort((a, b) => PESO[b.peso] - PESO[a.peso])[0]!;
  const limpos = cands.filter((c) => c.valor === valor && c.peso === 'limpo').length;
  const dissidentes = cands.some((c) => c.valor !== valor && c.peso === 'limpo');

  if (fonte === 'texto') {
    return { valor, confianca: escolhido.peso === 'limpo' ? 0.98 : 0.6, origem: 'texto do PDF (tabela por colunas)' };
  }
  let confianca: number;
  if (escolhido.peso === 'posicional') confianca = 0.5;
  else if (limpos === 0) confianca = 0.6;
  else if (limpos >= 2 && !dissidentes && limpos === totalPassadas) confianca = 0.9;
  else if (limpos >= 2) confianca = 0.75;
  else confianca = totalPassadas === 1 ? 0.85 : 0.7;
  const aviso = escolhido.peso === 'posicional' ? ' — rótulo ilegível, localizado pela posição' : escolhido.peso === 'reconstituido' ? ' — vírgula reconstituída' : '';
  return { valor, confianca, origem: rotuloOrigem(cands, escolhido, totalPassadas) + aviso };
}
