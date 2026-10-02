import { describe, expect, it } from 'vitest';
import { lerParametrosRedefinicao, linkDeRedefinicao } from './acesso-equipe';

const JWT = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura_x-y';

describe('link de redefinição de senha', () => {
  it('monta e lê de volta o mesmo token (link do proprietário)', () => {
    const link = linkDeRedefinicao('https://site.app/', 'abc123def456');
    expect(link).toBe('https://site.app/redefinir-senha?token_hash=abc123def456&type=recovery');
    expect(lerParametrosRedefinicao(new URL(link).search)).toEqual({ tokenHash: 'abc123def456' });
  });

  it('lê os tokens do e-mail padrão do Supabase (na âncora)', () => {
    const hash = `#access_token=${JWT}&expires_in=3600&refresh_token=abc123def456&token_type=bearer&type=recovery`;
    expect(lerParametrosRedefinicao('', hash)).toEqual({ accessToken: JWT, refreshToken: 'abc123def456' });
  });

  it('recusa tipo errado, token ausente ou com caracteres estranhos', () => {
    expect(lerParametrosRedefinicao('?token_hash=abc123def456&type=signup')).toBeNull();
    expect(lerParametrosRedefinicao('?type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('?token_hash=curto&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('?token_hash=abc<script>123&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('', `#access_token=${JWT}&refresh_token=abc123def456&type=signup`)).toBeNull();
    expect(lerParametrosRedefinicao('', '#access_token=naoejwt&refresh_token=abc123def456&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('')).toBeNull();
  });

  it('link expirado informado pelo Supabase (na query ou na âncora) não é válido', () => {
    expect(lerParametrosRedefinicao('?error=access_denied&error_code=otp_expired&token_hash=abc123def456&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('', '#error=access_denied&error_code=otp_expired')).toBeNull();
  });
});
