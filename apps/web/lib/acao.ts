import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_AVISO, PARAM_AVISO } from './acao-constantes';

/**
 * Erros de server action que o USUÁRIO precisa ler.
 *
 * Por quê: em produção o Next troca a mensagem de qualquer erro lançado numa action por
 * "An error occurred in the Server Components render…" (para não vazar detalhes). Então
 * `throw new Error('Selecione um arquivo PDF.')` aparecia como tela de erro genérica.
 * Mensagem esperada não é exceção: aqui ela vira um aviso (cookie curto + redirect de
 * volta à página) que o <AvisoFlash> mostra. Erro inesperado vira um texto genérico e o
 * detalhe vai para o log do servidor.
 */
export class ErroDeUsuario extends Error {
  override name = 'ErroDeUsuario';
}

export { COOKIE_AVISO, PARAM_AVISO };
export const MENSAGEM_GENERICA = 'Não foi possível concluir. Tente novamente em instantes.';

/** Converte o erro do Supabase em ErroDeUsuario (mensagem legível) ou erro genérico. */
export function lancarDoBanco(erro: { message: string; code?: string | null }): never {
  switch (erro.code) {
    // raise exception das nossas funções/triggers (limite do plano, convite inválido…): escritas para o usuário
    case 'P0001': throw new ErroDeUsuario(erro.message);
    case '42501': throw new ErroDeUsuario('Você não tem permissão para esta ação.');
    case '23505': throw new ErroDeUsuario('Este registro já existe.');
    case '23503': throw new ErroDeUsuario('Não é possível concluir: há outros registros ligados a este.');
    case '23514':
    case '22P02':
    case '22007':
    case '22003': throw new ErroDeUsuario('Algum valor informado é inválido. Confira os campos e tente de novo.');
    default:
      console.error('[acao] erro do banco:', erro);
      throw new Error(erro.message);
  }
}

/** redirect()/notFound() do Next são lançados como exceção e PRECISAM seguir adiante. */
export function ehControleDoNext(e: unknown): boolean {
  const digest = typeof e === 'object' && e !== null ? (e as { digest?: unknown }).digest : undefined;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

/** Mesma origem apenas; devolve caminho + query (sem o marcador anterior) ou "/". */
export function destinoDeRetorno(referer: string | null, host: string | null, marca: string): string {
  if (!referer || !host) return '/';
  try {
    const u = new URL(referer);
    if (u.host !== host) return '/';
    u.searchParams.set(PARAM_AVISO, marca);
    return u.pathname + u.search;
  } catch {
    return '/';
  }
}

/**
 * Envolve uma server action: falha esperada (ErroDeUsuario) ou inesperada vira aviso e a
 * pessoa volta para a página de onde veio. Use no export: `export const x = comAviso(async (fd) => …)`.
 */
export function comAviso<A extends unknown[], R>(acao: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    try {
      return await acao(...args);
    } catch (e) {
      if (ehControleDoNext(e)) throw e;
      let mensagem = MENSAGEM_GENERICA;
      if (e instanceof ErroDeUsuario) mensagem = e.message;
      else console.error('[acao] erro inesperado:', e);

      const jar = await cookies();
      jar.set(COOKIE_AVISO, encodeURIComponent(mensagem.slice(0, 300)), {
        path: '/', maxAge: 60, sameSite: 'lax', httpOnly: false, // o <AvisoFlash> lê e apaga no navegador
      });
      const h = await headers();
      redirect(destinoDeRetorno(h.get('referer'), h.get('host'), Math.random().toString(36).slice(2, 8)));
    }
  };
}
