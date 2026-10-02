import { describe, expect, it } from 'vitest';
import { lerParametrosRedefinicao, linkDeRedefinicao } from './acesso-equipe';

describe('link de redefinição de senha', () => {
  it('monta e lê de volta o mesmo token', () => {
    const link = linkDeRedefinicao('https://site.app/', 'abc123def456');
    expect(link).toBe('https://site.app/redefinir-senha?token_hash=abc123def456&type=recovery');
    expect(lerParametrosRedefinicao(new URL(link).search)).toEqual({ tokenHash: 'abc123def456' });
  });

  it('recusa tipo errado, token ausente ou com caracteres estranhos', () => {
    expect(lerParametrosRedefinicao('?token_hash=abc123def456&type=signup')).toBeNull();
    expect(lerParametrosRedefinicao('?type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('?token_hash=curto&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('?token_hash=abc<script>123&type=recovery')).toBeNull();
    expect(lerParametrosRedefinicao('')).toBeNull();
  });
});
