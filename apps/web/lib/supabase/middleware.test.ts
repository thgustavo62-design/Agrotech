import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Cookie = { name: string; value: string; options?: object };
type Retorno = { data: { claims: { sub: string; user_role?: string } } | null; error: { name?: string; status?: number } | null };
interface Cenario {
  getClaims: () => Promise<Retorno>;
  perfilRole?: string | null;
  /** cookies que a "renovação" grava quando há sessão válida */
  cookiesRenovados?: Cookie[];
}
let cenario: Cenario;
let consultasAoPerfil = 0;
let sequencia = 0; // cada requisição do teste tem um token diferente: nada vem do cache em memória

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: { setAll: (c: Cookie[]) => void } }) => ({
    auth: {
      // o código real lê o token da sessão e só então pede os claims
      getSession: async () => ({ data: { session: { access_token: `tok-${++sequencia}` } }, error: null }),
      getClaims: async () => {
        const r = await cenario.getClaims();
        if (r.data && cenario.cookiesRenovados) opts.cookies.setAll(cenario.cookiesRenovados);
        return r;
      },
    },
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              consultasAoPerfil++;
              return { data: cenario.perfilRole ? { role: cenario.perfilRole } : null };
            },
          }),
        }),
      }),
    }),
  }),
}));

import { atualizarSessao } from './middleware';

const pedir = (caminho: string) => atualizarSessao(new NextRequest(`https://app.exemplo.com${caminho}`));
const com = (user_role?: string): Retorno => ({ data: { claims: { sub: 'u1', ...(user_role ? { user_role } : {}) } }, error: null });
const logado = (extra: Partial<Cenario> = {}): Cenario => ({ getClaims: async () => com('consultor'), ...extra });
const semSessao: Cenario['getClaims'] = async () => ({ data: null, error: null });
const local = (r: Response) => (r.headers.get('location') ? new URL(r.headers.get('location')!).pathname : null);

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  consultasAoPerfil = 0;
});

describe('middleware de sessão', () => {
  it('sem sessão, /app vai para /login', async () => {
    cenario = { getClaims: semSessao };
    expect(local(await pedir('/app/talhoes'))).toBe('/login');
  });

  it('refresh token inválido (erro de credencial) também é "sem sessão"', async () => {
    cenario = { getClaims: async () => ({ data: null, error: { name: 'AuthApiError', status: 400 } }) };
    expect(local(await pedir('/app'))).toBe('/login');
  });

  it('com sessão, quem abre /login (aba nova, favorito, voltar) cai direto no /app', async () => {
    cenario = logado();
    expect(local(await pedir('/login'))).toBe('/app');
  });

  it('o redirect leva os cookies que a renovação do token acabou de gravar', async () => {
    cenario = logado({
      getClaims: async () => com('produtor'),
      cookiesRenovados: [{ name: 'sb-x-auth-token', value: 'NOVO', options: { path: '/' } }],
    });
    const r = await pedir('/app'); // produtor em área de consultor -> redirect
    expect(local(r)).toBe('/produtor');
    expect(r.headers.get('set-cookie')).toContain('sb-x-auth-token=NOVO');
  });

  it('falha momentânea do Auth (rede) NÃO desloga: segue sem redirecionar', async () => {
    let chamadas = 0;
    cenario = {
      getClaims: async () => {
        chamadas++;
        return { data: null, error: { name: 'AuthRetryableFetchError', status: 0 } };
      },
    };
    expect(local(await pedir('/app'))).toBeNull();
    expect(chamadas).toBe(2); // tentou de novo antes de desistir
  });

  it('soluço na primeira chamada e sucesso na segunda: mantém a sessão', async () => {
    let n = 0;
    cenario = {
      getClaims: async () => (++n === 1 ? { data: null, error: { name: 'AuthRetryableFetchError', status: 0 } } : com('consultor')),
    };
    expect(local(await pedir('/app'))).toBeNull();
  });

  it('papel vem do claim do token: nenhuma consulta ao banco por requisição', async () => {
    cenario = logado();
    await pedir('/app');
    expect(consultasAoPerfil).toBe(0);
  });

  it('token antigo sem o claim cai para o perfil', async () => {
    cenario = logado({ getClaims: async () => com(), perfilRole: 'consultor' });
    expect(local(await pedir('/app'))).toBeNull();
    expect(consultasAoPerfil).toBe(1);
  });

  it('perfil que não carrega não gera laço entre /app e /produtor', async () => {
    cenario = logado({ getClaims: async () => com(), perfilRole: null });
    expect(local(await pedir('/app'))).toBeNull();
    expect(local(await pedir('/produtor'))).toBeNull();
    expect(local(await pedir('/login'))).toBeNull();
  });

  it('rotas públicas nem consultam o Auth', async () => {
    let chamadas = 0;
    cenario = { getClaims: async () => { chamadas++; return { data: null, error: null }; } };
    await pedir('/sw.js');
    await pedir('/r/abc');
    expect(chamadas).toBe(0);
  });

  it('sem Supabase configurado só deixa passar', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    cenario = { getClaims: semSessao };
    expect(local(await pedir('/app'))).toBeNull();
  });
});
