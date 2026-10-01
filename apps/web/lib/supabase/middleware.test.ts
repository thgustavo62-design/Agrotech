import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Cookie = { name: string; value: string; options?: object };
interface Cenario {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: { name?: string; status?: number } | null }>;
  accessToken?: string | null;
  perfilRole?: string | null;
  /** cookies que a "renovação" grava ao chamar getUser */
  cookiesRenovados?: Cookie[];
}
let cenario: Cenario;
let consultasAoPerfil = 0;

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: { setAll: (c: Cookie[]) => void } }) => ({
    auth: {
      getUser: async () => {
        const r = await cenario.getUser();
        if (r.data.user && cenario.cookiesRenovados) opts.cookies.setAll(cenario.cookiesRenovados);
        return r;
      },
      getSession: async () => ({ data: { session: cenario.accessToken ? { access_token: cenario.accessToken } : null } }),
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

const token = (role?: string) => `x.${Buffer.from(JSON.stringify(role ? { user_role: role } : {})).toString('base64url')}.y`;
const pedir = (caminho: string) => atualizarSessao(new NextRequest(`https://app.exemplo.com${caminho}`));
const logado = (extra: Partial<Cenario> = {}): Cenario => ({
  getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
  accessToken: token('consultor'),
  ...extra,
});
const deslogado: Cenario['getUser'] = async () => ({ data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400 } });
const local = (r: Response) => (r.headers.get('location') ? new URL(r.headers.get('location')!).pathname : null);

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  consultasAoPerfil = 0;
});

describe('middleware de sessão', () => {
  it('sem sessão, /app vai para /login', async () => {
    cenario = { getUser: deslogado };
    expect(local(await pedir('/app/talhoes'))).toBe('/login');
  });

  it('com sessão, quem abre /login (aba nova, favorito, voltar) cai direto no /app', async () => {
    cenario = logado();
    expect(local(await pedir('/login'))).toBe('/app');
  });

  it('o redirect leva os cookies que a renovação do token acabou de gravar', async () => {
    cenario = logado({
      accessToken: token('produtor'),
      cookiesRenovados: [{ name: 'sb-x-auth-token', value: 'NOVO', options: { path: '/' } }],
    });
    const r = await pedir('/app'); // produtor em área de consultor -> redirect
    expect(local(r)).toBe('/produtor');
    expect(r.headers.get('set-cookie')).toContain('sb-x-auth-token=NOVO');
  });

  it('falha momentânea do Auth (rede) NÃO desloga: segue sem redirecionar', async () => {
    let chamadas = 0;
    cenario = {
      getUser: async () => {
        chamadas++;
        return { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } };
      },
    };
    const r = await pedir('/app');
    expect(local(r)).toBeNull();
    expect(chamadas).toBe(2); // tentou de novo antes de desistir
  });

  it('soluço na primeira chamada e sucesso na segunda: mantém a sessão', async () => {
    let n = 0;
    cenario = logado({
      getUser: async () => (++n === 1
        ? { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } }
        : { data: { user: { id: 'u1' } }, error: null }),
    });
    expect(local(await pedir('/app'))).toBeNull();
  });

  it('papel vem do claim do token: nenhuma consulta ao banco por requisição', async () => {
    cenario = logado();
    await pedir('/app');
    expect(consultasAoPerfil).toBe(0);
  });

  it('token antigo sem claim cai para o perfil', async () => {
    cenario = logado({ accessToken: token(), perfilRole: 'consultor' });
    expect(local(await pedir('/app'))).toBeNull();
    expect(consultasAoPerfil).toBe(1);
  });

  it('perfil que não carrega não gera laço entre /app e /produtor', async () => {
    cenario = logado({ accessToken: token(), perfilRole: null });
    expect(local(await pedir('/app'))).toBeNull();
    expect(local(await pedir('/produtor'))).toBeNull();
    expect(local(await pedir('/login'))).toBeNull();
  });

  it('rotas públicas nem consultam o Auth', async () => {
    let chamadas = 0;
    cenario = { getUser: async () => { chamadas++; return deslogado(); } };
    await pedir('/sw.js');
    await pedir('/r/abc');
    expect(chamadas).toBe(0);
  });

  it('sem Supabase configurado só deixa passar', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    cenario = { getUser: deslogado };
    expect(local(await pedir('/app'))).toBeNull();
  });
});
