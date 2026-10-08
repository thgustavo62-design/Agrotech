// Autorização das Edge Functions que usam a service_role.
//
// A service_role IGNORA a RLS: sem estas checagens, qualquer um com a chave pública (anon) ou um token velho
// chamaria a função com poder de administrador. Regras:
//   1. quem chama é identificado pelo JWT (getUser valida a assinatura no servidor de Auth);
//   2. a permissão vem de agro.pode() — a MESMA regra do banco (perfil ativo, escritório, não desativado);
//   3. o escritório do recurso tem que ser o ESCRITÓRIO ATUAL da pessoa, lido do perfil (não do token: o token
//      carrega o org_id de quando foi emitido e sobrevive à remoção por até 1 hora).

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { json } from './cors.ts';
import { tokenBearer } from './seguranca.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Cliente com poder total — use SÓ depois de autorizar. */
export const clienteServico = () => createClient(supabaseUrl, serviceRole);

export type Identificado = { ok: true; usuario: User; comoUsuario: SupabaseClient } | { ok: false; resposta: Response };

export async function identificar(req: Request): Promise<Identificado> {
  const jwt = tokenBearer(req.headers.get('authorization'));
  if (!jwt) return { ok: false, resposta: json({ erro: 'não autenticado' }, 401) };
  const comoUsuario = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data, error } = await comoUsuario.auth.getUser(jwt);
  if (error || !data.user) return { ok: false, resposta: json({ erro: 'sessão inválida' }, 401) };
  return { ok: true, usuario: data.user, comoUsuario };
}

/** A pessoa é da equipe do escritório `orgId` agora e tem a permissão (perfil ativo, não removida)? */
export async function equipeAutorizada(
  { usuario, comoUsuario }: { usuario: User; comoUsuario: SupabaseClient },
  orgId: string,
  permissao: string,
): Promise<boolean> {
  const { data: pode } = await comoUsuario.schema('agro').rpc('pode', { p_permissao: permissao });
  if (pode !== true) return false;
  const { data: perfil } = await clienteServico().schema('agro').from('profiles')
    .select('org_id, desativado_em').eq('id', usuario.id).maybeSingle();
  return Boolean(perfil) && perfil!.org_id === orgId && !perfil!.desativado_em;
}
