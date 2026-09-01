/**
 * Conversão de número em formato brasileiro.
 *
 * Armadilhas tratadas (doc seção 8.3):
 *   "4,52"      -> 4.52     (vírgula decimal)
 *   "1.250"     -> 1250     (ponto como separador de milhar)
 *   "1.234,56"  -> 1234.56  (milhar + decimal)
 *   "0.5"       -> 0.5      (ponto decimal isolado, formato US)
 *   "12"        -> 12
 *   ""/lixo     -> null
 */
export function parseNumeroBR(entrada: unknown): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null;
  if (entrada == null) return null;

  let s = String(entrada).trim();
  if (s === '') return null;

  // mantém só o primeiro bloco de dígitos, sinais e separadores
  const m = s.match(/-?\d[\d.,]*\d|-?\d/);
  if (!m) return null;
  s = m[0];

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  if (temVirgula && temPonto) {
    // o último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (temVirgula) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    // ponto sozinho: milhar se for \d{1,3}(\.\d{3})+, senão decimal
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  }

  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

/** Normaliza texto para casamento: minúsculas, sem acento, espaços colapsados. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
