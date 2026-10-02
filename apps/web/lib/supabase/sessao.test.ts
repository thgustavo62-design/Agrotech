import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lerSessao, limparCacheDeSessao } from './sessao';

type Claims = { sub?: string; user_role?: string; exp?: number };

function cliente(opts: {
  token?: string | null;
  errSessao?: { name?: string; status?: number } | null;
  claims?: () => Promise<{ data: { claims: Claims } | null; error: { name?: string; status?: number } | null }>;
}) {
  const getSession = vi.fn(async () => ({
    data: { session: opts.token === null ? null : { access_token: opts.token ?? 'tok-1' } },
    error: opts.errSessao ?? null,
  }));
  const getClaims = vi.fn(opts.claims ?? (async () => ({ data: { claims: { sub: 'u1', user_role: 'consultor' } }, error: null })));
  return { sb: { auth: { getSession, getClaims } } as unknown as SupabaseClient, getSession, getClaims };
}

beforeEach(() => {
  limparCacheDeSessao();
  vi.useRealTimers();
});

describe('lerSessao', () => {
  it('lê id e papel dos claims', async () => {
    const { sb } = cliente({});
    expect(await lerSessao(sb)).toEqual({ sessao: { id: 'u1', papel: 'consultor' }, transitoria: false });
  });

  it('sem token é "sem sessão" e não consulta o Auth', async () => {
    const { sb, getClaims } = cliente({ token: null });
    expect(await lerSessao(sb)).toEqual({ sessao: null, transitoria: false });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('o mesmo token não é conferido de novo dentro de 60 s (tempestade de pré-carregamento)', async () => {
    const { sb, getClaims } = cliente({});
    for (let i = 0; i < 20; i++) await lerSessao(sb);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it('depois de 60 s confere de novo', async () => {
    vi.useFakeTimers();
    const { sb, getClaims } = cliente({});
    await lerSessao(sb);
    vi.advanceTimersByTime(61_000);
    await lerSessao(sb);
    expect(getClaims).toHaveBeenCalledTimes(2);
  });

  it('token novo (renovado) é conferido na hora', async () => {
    const a = cliente({ token: 'tok-A' });
    const b = cliente({ token: 'tok-B' });
    await lerSessao(a.sb);
    await lerSessao(b.sb);
    expect(a.getClaims).toHaveBeenCalledTimes(1);
    expect(b.getClaims).toHaveBeenCalledTimes(1);
  });

  it('token que expira antes dos 60 s não fica em cache além do exp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const exp = Math.floor(Date.now() / 1000) + 10;
    const { sb, getClaims } = cliente({ claims: async () => ({ data: { claims: { sub: 'u1', exp } }, error: null }) });
    await lerSessao(sb);
    vi.advanceTimersByTime(11_000);
    await lerSessao(sb);
    expect(getClaims).toHaveBeenCalledTimes(2);
  });

  it('falha de conferência NÃO é guardada: a próxima tentativa tenta de novo', async () => {
    let n = 0;
    const { sb, getClaims } = cliente({
      claims: async () => (++n === 1 ? { data: null, error: { name: 'AuthRetryableFetchError', status: 0 } } : { data: { claims: { sub: 'u1' } }, error: null }),
    });
    expect(await lerSessao(sb)).toEqual({ sessao: null, transitoria: true });
    expect((await lerSessao(sb)).sessao?.id).toBe('u1');
    expect(getClaims).toHaveBeenCalledTimes(2);
  });

  it('token inválido (credencial) é "sem sessão", não transitório', async () => {
    const { sb } = cliente({ claims: async () => ({ data: null, error: { name: 'AuthInvalidJwtError', status: 401 } }) });
    expect(await lerSessao(sb)).toEqual({ sessao: null, transitoria: false });
  });
});
