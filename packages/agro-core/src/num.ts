/**
 * Utilidades numéricas. O motor nunca lança por entrada inválida: converte o
 * que dá e trata ausência como zero, deixando a validação de plausibilidade
 * para a camada de parser (`parsers/sanidade.ts`) e para o formulário.
 */

/** Converte para número aceitando vírgula decimal e string vazia. Nunca NaN. */
export function n(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const x = Number.parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}

/** Arredonda para `casas` casas decimais (padrão 0), sem viés de ponto flutuante. */
export function arred(v: number, casas = 0): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/** Limita `v` ao intervalo [min, max]. */
export function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Divisão protegida: retorna 0 quando o divisor é 0. */
export function div(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}
