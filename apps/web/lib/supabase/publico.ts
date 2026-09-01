import { createClient } from '@supabase/supabase-js';

/**
 * Cliente anônimo, sem sessão — usado apenas pelo link público de resultados
 * (/r/[token]). Só chama a função `agro.resultados_por_token`, que é security
 * definer e escopa tudo ao token. As tabelas continuam fechadas pela RLS.
 */
export function clientePublico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
