/**
 * Formatação numérica pt-BR para os textos de diagnóstico e de recomendação.
 * A UI tem o próprio formatador; aqui é só para as frases que o motor monta.
 */

function fmt(v: number, casas: number): string {
  const x = Number.isFinite(v) ? v : 0;
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Sem casas decimais. */
export const f0 = (v: number): string => fmt(v, 0);
/** Uma casa decimal. */
export const f1 = (v: number): string => fmt(v, 1);
/** Duas casas decimais. */
export const f2 = (v: number): string => fmt(v, 2);
