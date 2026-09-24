import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Feature flag do plano do escritório — funciona tanto pro consultor quanto
 * pro produtor (agro.tenho_feature() é security definer, não depende da
 * política de leitura de agro.assinaturas, que é só consultor/admin).
 */
export async function temFeature(sb: SupabaseClient, chave: string): Promise<boolean> {
  const { data } = await sb.schema('agro').rpc('tenho_feature', { p_chave: chave });
  return data === true;
}
