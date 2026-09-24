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
