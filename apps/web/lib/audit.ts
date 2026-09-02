import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Trilha de auditoria (LGPD — você é operador, ver PRODUTO-VENDAVEL §7).
 * Registra as ações que importam: emissão de laudo, correção de campo extraído,
 * convite, alteração de cadastro e de tabela de referência.
 *
 * Nunca lança: auditoria que quebra a ação principal é pior que auditoria que
 * falha silenciosa. O erro vai para o console do servidor.
 */
export async function registrar(
  sb: SupabaseClient,
  entrada: {
    org_id?: string | null;
    acao: string;
    entidade?: string;
    entidade_id?: string | null;
    dados?: unknown;
  },
): Promise<void> {
  try {
    const { data: { user } } = await sb.auth.getUser();
    await sb.schema('agro').from('audit_log').insert({
      org_id: entrada.org_id ?? null,
      user_id: user?.id ?? null,
      acao: entrada.acao,
      entidade: entrada.entidade ?? null,
      entidade_id: entrada.entidade_id ?? null,
      dados: entrada.dados ?? null,
    });
  } catch (e) {
    console.error('[audit] falhou:', entrada.acao, e);
  }
}
