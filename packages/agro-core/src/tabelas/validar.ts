import type { Cultura } from '../tipos.js';

export interface ResultadoValidacao {
  /** impedem salvar */
  erros: string[];
  /** não impedem — o agrônomo decide */
  avisos: string[];
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Valida os números de uma cultura editada por um escritório. Erros são valores
 * que quebram o motor (NaN, negativo, V% fora de 0–100); avisos são doses que
 * fogem do padrão agronômico (dose crescendo conforme o solo fica mais rico).
 */
export function validarCultura(c: Cultura): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!c.nome.trim()) erros.push('Nome da cultura vazio.');
  if (!ok(c.ref) || c.ref <= 0) erros.push('Produtividade de referência deve ser maior que zero.');
  if (!ok(c.V2) || c.V2 <= 0 || c.V2 > 100) erros.push('V% desejado deve estar entre 0 e 100.');
  if (!ok(c.m_max) || c.m_max < 0 || c.m_max > 100) erros.push('m% máximo deve estar entre 0 e 100.');
  if (!ok(c.N) || c.N < 0) erros.push('N não pode ser negativo.');

  for (const [rotulo, doses] of [['P₂O₅', c.P], ['K₂O', c.K]] as const) {
    if (doses.length !== 5 || doses.some((d) => !ok(d) || d < 0)) {
      erros.push(`${rotulo}: informe 5 doses (MB, B, M, Bom, MBom), todas ≥ 0.`);
    } else if (doses.some((d, i) => i > 0 && d > doses[i - 1]!)) {
      avisos.push(`${rotulo}: a dose sobe em solo mais rico — confira a ordem MB → MBom.`);
    }
  }
  return { erros, avisos };
}
