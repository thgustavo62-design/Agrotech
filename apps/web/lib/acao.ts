import { cookies, headers } from 'next/headers';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { COOKIE_AVISO, PARAM_AVISO } from './acao-constantes';
import { registrarErro } from './log';

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
    case 'P0001':
    // regras do banco com mensagem escrita para o usuário (Academy: "adicione uma aula antes de publicar", "só conteúdo publicado pode ser indicado"…)
    case '22023': throw new ErroDeUsuario(erro.message);
    case '42501': throw new ErroDeUsuario('Você não tem permissão para esta ação.');
    case '23505': throw new ErroDeUsuario('Este registro já existe.');
    case '23503': throw new ErroDeUsuario('Não é possível concluir: há outros registros ligados a este.');
    case '23514':
    case '22P02':
    case '22007':
    case '22003': throw new ErroDeUsuario('Algum valor informado é inválido. Confira os campos e tente de novo.');
    default:
      registrarErro('banco', erro);
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
 * Depois de uma ação bem-sucedida, manda os avisos no celular das notificações que ela fez nascer (lib/push.ts). Só roda com as
 * chaves de aviso configuradas; roda DEPOIS de responder à pessoa e nunca derruba a ação.
 */
function agendarAvisosNoCelular() {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  try {
    after(async () => {
      const { despacharPush } = await import('./push');
      await despacharPush();
    });
  } catch {
    // fora de uma requisição (testes): sem aviso, sem problema
  }
}

/**
 * Envolve uma server action: falha esperada (ErroDeUsuario) ou inesperada vira aviso e a
 * pessoa volta para a página de onde veio. Use no export: `export const x = comAviso(async (fd) => …)`.
 */
export function comAviso<A extends unknown[], R>(acao: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    try {
      const resultado = await acao(...args);
      agendarAvisosNoCelular();
      return resultado;
    } catch (e) {
      if (ehControleDoNext(e)) {
        // redirect()/notFound(): a ação terminou como previsto
        agendarAvisosNoCelular();
        throw e;
      }
      let mensagem = MENSAGEM_GENERICA;
      if (e instanceof ErroDeUsuario) mensagem = e.message;
      else registrarErro('acao.inesperado', e, undefined, (await headers()).get('x-vercel-id'));

      const jar = await cookies();
      jar.set(COOKIE_AVISO, encodeURIComponent(mensagem.slice(0, 300)), {
        path: '/', maxAge: 60, sameSite: 'lax', httpOnly: false, // o <AvisoFlash> lê e apaga no navegador
      });
      const h = await headers();
      redirect(destinoDeRetorno(h.get('referer'), h.get('host'), Math.random().toString(36).slice(2, 8)));
    }
  };
}
