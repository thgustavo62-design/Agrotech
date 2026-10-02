/**
 * Link de redefinição de senha. Dois formatos chegam à página /redefinir-senha:
 *  - `?token_hash=…&type=recovery` — o link que o proprietário gera para um empregado (admin.generateLink);
 *  - `#access_token=…&refresh_token=…&type=recovery` — o e-mail padrão "Reset password" do Supabase quando o
 *    pedido usa o fluxo *implicit* (login/page.tsx). Funciona abrindo o e-mail em OUTRO aparelho; o fluxo PKCE
 *    (`?code=`) não, porque o verificador fica no navegador que pediu. O template do e-mail não é editável
 *    sem SMTP próprio.
 * Quando o link expirou o Supabase devolve `error=…&error_code=otp_expired` (na query ou na âncora `#`).
 */

export function linkDeRedefinicao(site: string, tokenHash: string): string {
  return `${site.replace(/\/$/, '')}/redefinir-senha?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
}

const RE_TOKEN = /^[A-Za-z0-9_-]{8,200}$/;
// JWT: três partes base64url separadas por ponto
const RE_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

export type ParametrosRedefinicao =
  | { tokenHash: string }
  | { accessToken: string; refreshToken: string };

/** Lê o que veio na URL (`search` + `hash`); null se não for um link válido (ou se o Supabase informou erro). */
export function lerParametrosRedefinicao(search: string, hash = ''): ParametrosRedefinicao | null {
  const p = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('error') || p.get('error_code') || h.get('error') || h.get('error_code')) return null;

  const tokenHash = p.get('token_hash') ?? '';
  if (p.get('type') === 'recovery' && RE_TOKEN.test(tokenHash)) return { tokenHash };

  const accessToken = h.get('access_token') ?? '';
  const refreshToken = h.get('refresh_token') ?? '';
  if (h.get('type') === 'recovery' && RE_JWT.test(accessToken) && RE_TOKEN.test(refreshToken)) return { accessToken, refreshToken };
  return null;
}
