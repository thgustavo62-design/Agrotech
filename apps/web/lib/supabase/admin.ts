import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a service role — ignora a RLS. Só no servidor (server actions /
 * route handlers), nunca importar de componente de cliente. Hoje existe para
 * uma única coisa: eliminar a conta de auth do produtor no pedido LGPD, que o
 * cliente com sessão do consultor não tem permissão de fazer.
 * Retorna null quando SUPABASE_SERVICE_ROLE_KEY não está configurada.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
