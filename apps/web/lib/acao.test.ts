import { beforeEach, describe, expect, it, vi } from 'vitest';

const definidos: Array<{ nome: string; valor: string; opcoes: Record<string, unknown> }> = [];
let referer: string | null = null;
let host: string | null = 'app.exemplo.com';

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: (nome: string, valor: string, opcoes: Record<string, unknown>) => definidos.push({ nome, valor, opcoes }) }),
  headers: async () => ({ get: (k: string) => (k === 'referer' ? referer : k === 'host' ? host : null) }),
}));
vi.mock('next/navigation', () => ({
  // o redirect do Next é uma exceção com digest NEXT_REDIRECT
  redirect: (destino: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${destino};307;` });
  },
}));

import { comAviso, destinoDeRetorno, ehControleDoNext, ErroDeUsuario, lancarDoBanco, MENSAGEM_GENERICA } from './acao';

beforeEach(() => {
  definidos.length = 0;
  referer = 'https://app.exemplo.com/app/talhoes/42?aba=fotos';
  host = 'app.exemplo.com';
});

const aviso = () => decodeURIComponent(definidos[0]!.valor);
const capturarRedirect = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    return (e as { digest?: string }).digest ?? null;
  }
  return null;
};

describe('comAviso', () => {
  it('devolve o resultado quando tudo dá certo, sem aviso', async () => {
    const acao = comAviso(async (x: number) => x * 2);
    expect(await acao(21)).toBe(42);
    expect(definidos).toEqual([]);
  });

  it('erro de usuário vira aviso com a mensagem e volta para a página de origem', async () => {
    const acao = comAviso(async () => {
      throw new ErroDeUsuario('Selecione um arquivo PDF.');
    });
    const digest = await capturarRedirect(() => acao());
    expect(aviso()).toBe('Selecione um arquivo PDF.');
    expect(digest).toMatch(/^NEXT_REDIRECT;replace;\/app\/talhoes\/42\?aba=fotos&_a=\w+;/);
    expect(definidos[0]!.opcoes).toMatchObject({ path: '/', maxAge: 60, httpOnly: false, sameSite: 'lax' });
  });

  it('erro inesperado mostra texto genérico (não vaza o detalhe) e loga no servidor', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const acao = comAviso(async () => {
      throw new Error('duplicate key value violates unique constraint "visitas_pkey"');
    });
    await capturarRedirect(() => acao());
    expect(aviso()).toBe(MENSAGEM_GENERICA);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('redirect() dentro da ação segue adiante: não vira aviso', async () => {
    const acao = comAviso(async () => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/app/analises/1;307;' });
    });
    expect(await capturarRedirect(() => acao())).toBe('NEXT_REDIRECT;push;/app/analises/1;307;');
    expect(definidos).toEqual([]);
  });

  it('mensagem com acento e % sobrevive ao cookie', async () => {
    const acao = comAviso(async () => {
      throw new ErroDeUsuario('Umidade 100% inválida — corrija');
    });
    await capturarRedirect(() => acao());
    expect(aviso()).toBe('Umidade 100% inválida — corrija');
  });

  it('mensagem enorme é cortada', async () => {
    const acao = comAviso(async () => {
      throw new ErroDeUsuario('x'.repeat(2000));
    });
    await capturarRedirect(() => acao());
    expect(aviso().length).toBe(300);
  });
});

describe('destinoDeRetorno', () => {
  it('mesma origem: mantém caminho e query e troca o marcador', () => {
    expect(destinoDeRetorno('https://a.com/app?x=1&_a=velho', 'a.com', 'novo')).toBe('/app?x=1&_a=novo');
  });
  it('origem diferente, ausente ou lixo caem em "/" (sem redirect aberto)', () => {
    expect(destinoDeRetorno('https://malicioso.com/app', 'a.com', 'n')).toBe('/');
    expect(destinoDeRetorno(null, 'a.com', 'n')).toBe('/');
    expect(destinoDeRetorno('isso não é url', 'a.com', 'n')).toBe('/');
  });
});

describe('lancarDoBanco', () => {
  const tenta = (erro: { message: string; code?: string }) => {
    try {
      lancarDoBanco(erro);
    } catch (e) {
      return e as Error;
    }
    return null;
  };

  it('P0001 (nossas funções) expõe a mensagem escrita para o usuário', () => {
    const e = tenta({ code: 'P0001', message: 'Limite do plano atingido: 3 talhões.' });
    expect(e).toBeInstanceOf(ErroDeUsuario);
    expect(e!.message).toBe('Limite do plano atingido: 3 talhões.');
  });
  it('RLS, duplicidade e FK viram mensagens em português, sem nome de tabela/constraint', () => {
    expect(tenta({ code: '42501', message: 'new row violates row-level security policy for table "talhoes"' })!.message).toMatch(/permissão/);
    expect(tenta({ code: '23505', message: 'duplicate key ... "visitas_chave_cliente_uk"' })!.message).toBe('Este registro já existe.');
    expect(tenta({ code: '23503', message: 'violates foreign key constraint' })!.message).toMatch(/ligados/);
    expect(tenta({ code: '22P02', message: 'invalid input syntax for type uuid' })).toBeInstanceOf(ErroDeUsuario);
  });
  it('código desconhecido não é ErroDeUsuario (cai no genérico)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(tenta({ code: 'XX000', message: 'interno' })).not.toBeInstanceOf(ErroDeUsuario);
    log.mockRestore();
  });
});

describe('ehControleDoNext', () => {
  it('reconhece redirect/notFound e ignora erros comuns', () => {
    expect(ehControleDoNext({ digest: 'NEXT_REDIRECT;push;/x;307;' })).toBe(true);
    expect(ehControleDoNext({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })).toBe(true);
    expect(ehControleDoNext(new Error('x'))).toBe(false);
    expect(ehControleDoNext(null)).toBe(false);
  });
});
