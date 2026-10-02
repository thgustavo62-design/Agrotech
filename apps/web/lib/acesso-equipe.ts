/**
 * Link de redefinição de senha — o MESMO formato para os dois caminhos:
 *  - o e-mail "Reset password" do Supabase (template com `{{ .TokenHash }}`);
 *  - o link que o proprietário gera para um empregado (server action, admin.generateLink).
 * A página /redefinir-senha troca o `token_hash` por sessão (verifyOtp) e pede a nova senha.
 */

export function linkDeRedefinicao(site: string, tokenHash: string): string {
  return `${site.replace(/\/$/, '')}/redefinir-senha?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
}

const RE_TOKEN = /^[A-Za-z0-9_-]{8,200}$/;

/** Lê `?token_hash=…&type=recovery`; qualquer outra coisa (inclusive tipo diferente) é inválida. */
export function lerParametrosRedefinicao(search: string): { tokenHash: string } | null {
  const p = new URLSearchParams(search);
  const tokenHash = p.get('token_hash') ?? '';
  if (p.get('type') !== 'recovery' || !RE_TOKEN.test(tokenHash)) return null;
  return { tokenHash };
}
