// Utilidades de segurança SEM dependência de Deno — testáveis em Node (packages/db-test/test/edge-seguranca.test.ts).

/** Compara sem sair no primeiro byte diferente (o tempo não revela quantos bytes do segredo acertou). */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** "Bearer abc" → "abc"; qualquer outra coisa → null. */
export function tokenBearer(cabecalho: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(cabecalho ?? '');
  return m ? m[1]! : null;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === 'string' && RE_UUID.test(v);

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ehEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && RE_EMAIL.test(v);

/**
 * Segredo interno (webhook do banco, outra função): só vale se estiver CONFIGURADO (não vazio) e igual.
 * Segredo ausente no ambiente nunca autoriza — nem "vazio com vazio".
 */
export function segredoConfere(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!esperado || esperado.length < 16) return false;
  return iguaisEmTempoConstante(recebido ?? '', esperado);
}
