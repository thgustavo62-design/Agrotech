/**
 * Qual análise de 20–40 cm vale para a gessagem de uma amostra de 0–20 cm: a do MESMO talhão, não arquivada,
 * coletada até 24 meses antes ou depois da superficial (o perfil muda com calagem e adubação); se houver várias,
 * a mais próxima no tempo. Função pura para testar.
 */

export const JANELA_MESES = 24;

export interface CandidataSub { data_coleta: string; [k: string]: unknown }

const ms = (iso: string) => Date.parse(iso.slice(0, 10) + 'T12:00:00Z');

export function escolherSubsuperficie<T extends CandidataSub>(candidatas: readonly T[], dataSuperficie: string): T | null {
  const alvo = ms(dataSuperficie);
  if (!Number.isFinite(alvo)) return null;
  const limite = JANELA_MESES * 30.44 * 86_400_000;
  let melhor: { c: T; d: number } | null = null;
  for (const c of candidatas) {
    const t = ms(String(c.data_coleta));
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - alvo);
    if (d <= limite && (!melhor || d < melhor.d)) melhor = { c, d };
  }
  return melhor?.c ?? null;
}
