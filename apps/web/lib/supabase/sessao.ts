import type { SupabaseClient } from '@supabase/supabase-js';
import { ehFalhaTransitoria, papelDeValor, type Papel } from './rotas';

export interface SessaoLida {
  id: string;
  papel: Papel;
}

/** Validade da conferência em memória. Curta: é só para não repetir a mesma conta a cada link pré-carregado. */
const TTL_MS = 60_000;
const MAX_ENTRADAS = 500;
const jaConferidos = new Map<string, { sessao: SessaoLida; ate: number }>();

/** Só para testes. */
export function limparCacheDeSessao(): void {
  jaConferidos.clear();
}

function guardar(token: string, sessao: SessaoLida, expSegundos?: number): void {
  const ate = Math.min(Date.now() + TTL_MS, expSegundos ? expSegundos * 1000 : Infinity);
  if (jaConferidos.size >= MAX_ENTRADAS) {
    // descarta o mais antigo (Map mantém a ordem de inserção)
    const primeiro = jaConferidos.keys().next().value;
    if (primeiro !== undefined) jaConferidos.delete(primeiro);
  }
  jaConferidos.set(token, { sessao, ate });
}

/**
 * Quem está logado, a partir dos claims do token — SEM ir ao Supabase quando o projeto usa chaves
 * assimétricas (assinatura e validade são conferidas aqui, com o JWKS em cache). Em projetos
 * antigos (HS256) o supabase-js valida pela rede (como o getUser de antes); o resultado fica 60 s
 * em memória por token, então uma tempestade de pré-carregamento de links não vira uma tempestade
 * de chamadas ao Auth.
 *
 * Por que importa: `getUser()` é uma ida ao Auth a CADA chamada. Uma única página fazia 4 em fila
 * (middleware, layout, página, auditoria) e o middleware repetia a conta em cada link do menu —
 * com 100 ms de rede, ~500 ms antes do primeiro byte.
 *
 * Token expirado: `getSession` renova pelo refresh token (e grava os cookies novos), então a
 * renovação continua acontecendo no middleware. Sessão revogada em outro lugar continua valendo
 * até o token expirar (≤ 1 h) — o PostgREST já se comporta assim, e a RLS é a barreira real.
 */
export async function lerSessao(sb: SupabaseClient): Promise<{ sessao: SessaoLida | null; transitoria: boolean }> {
  const { data: dadosSessao, error: erroSessao } = await sb.auth.getSession();
  const token = dadosSessao.session?.access_token;
  if (!token) return { sessao: null, transitoria: ehFalhaTransitoria(erroSessao) };

  const guardado = jaConferidos.get(token);
  if (guardado && guardado.ate > Date.now()) return { sessao: guardado.sessao, transitoria: false };

  const { data, error } = await sb.auth.getClaims(token);
  const claims = data?.claims as { sub?: string; user_role?: unknown; exp?: number } | undefined;
  if (claims?.sub) {
    const sessao: SessaoLida = { id: claims.sub, papel: papelDeValor(claims.user_role) };
    guardar(token, sessao, claims.exp);
    return { sessao, transitoria: false };
  }
  return { sessao: null, transitoria: ehFalhaTransitoria(error) };
}

/**
 * Nível de autenticação da sessão: 'aal1' (só a senha) ou 'aal2' (senha + código do segundo fator), lido dos claims
 * JÁ validados do token. Só é chamado para quem ligou a verificação em duas etapas (perfil.mfa_ativo).
 */
export async function nivelDeAutenticacao(sb: SupabaseClient): Promise<'aal1' | 'aal2' | null> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const { data: c } = await sb.auth.getClaims(token);
  const aal = (c?.claims as { aal?: string } | undefined)?.aal;
  return aal === 'aal2' ? 'aal2' : aal === 'aal1' ? 'aal1' : null;
}
