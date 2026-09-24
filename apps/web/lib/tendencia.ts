/**
 * % de variação vs. uma snapshot anterior de agro.metricas_diarias.
 * null quando não dá pra calcular direito (sem base anterior, ou base
 * zerada) — o chamador deve simplesmente omitir a tendência nesse caso,
 * nunca mostrar "+0%" ou inventar.
 */
export function pctTendencia(atual: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}
