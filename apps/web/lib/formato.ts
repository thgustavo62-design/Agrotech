/** Formatação pt-BR para a UI. */

export function f(v: number, casas = 1): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function moeda(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

const FUSO = 'America/Sao_Paulo';
const formatadorDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Data civil (yyyy-mm-dd) no fuso de Brasília. NÃO usar `new Date().toISOString().slice(0, 10)`:
 * isso é a data em UTC, e das 21h às 23h59 em Brasília já é "amanhã" — a visita, a análise e
 * o laudo ganhavam a data errada, e "conta vencida hoje" virava "vence amanhã".
 * O servidor (Vercel) roda em UTC; o produtor e o consultor, não.
 */
export function hojeISO(agora: Date = new Date()): string {
  return formatadorDia.format(agora);
}

/** Data civil de Brasília `dias` dias a partir de agora (negativo = passado). */
export function diasDepoisISO(dias: number, agora: Date = new Date()): string {
  // soma em dias civis, não em 24h: parte do meio-dia do dia de Brasília para não cruzar a virada
  const [a, m, d] = hojeISO(agora).split('-').map(Number) as [number, number, number];
  const base = new Date(Date.UTC(a, m - 1, d + dias, 12));
  return base.toISOString().slice(0, 10);
}
