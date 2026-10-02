import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { decidirRota, ehPublica, papelDeValor, type Papel } from './rotas';
import { lerSessao, type SessaoLida } from './sessao';

type CookieParaGravar = { name: string; value: string; options?: CookieOptions };

/**
 * Renova a sessão e roteia por perfil. É CONVENIÊNCIA de navegação — a barreira
 * real é a RLS no banco (doc §5.5). As regras estão em ./rotas.ts (testadas).
 *
 * Cuidados que já custaram o login do usuário:
 *  - o redirect carrega os cookies que a renovação acabou de gravar; sem isso o refresh
 *    token antigo (já consumido) continua no navegador e a sessão morre;
 *  - falha momentânea do Auth (rede, 5xx, 429) não vira "sem sessão";
 *  - quem está logado vem dos claims do token, validados localmente (lib/supabase/sessao.ts):
 *    sem ida ao Auth por requisição nem por link pré-carregado.
 */
export async function atualizarSessao(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // sem Supabase configurado (preview / vitrine) o middleware apenas passa
  if (!supaUrl || !supaKey) return res;

  const caminho = req.nextUrl.pathname;
  if (ehPublica(caminho)) return res;

  const sb = createServerClient(supaUrl, supaKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: CookieParaGravar[]) {
        for (const { name, value } of cookiesToSet) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of cookiesToSet) res.cookies.set(name, value, options);
      },
    },
  });

  // uma segunda tentativa cobre soluço de rede ao acordar a aba/aparelho
  let sessao: SessaoLida | null = null;
  let transitoria = false;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    ({ sessao, transitoria } = await lerSessao(sb));
    if (!transitoria) break;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  // Auth fora do ar não é "deslogado": segue; o guarda do layout e a RLS protegem de qualquer modo
  if (transitoria) return res;

  let papel: Papel = sessao?.papel ?? null;
  if (sessao && !papel) {
    // token antigo, sem o claim: cai para o perfil
    const { data: perfil } = await sb.schema('agro').from('profiles').select('role').eq('id', sessao.id).maybeSingle();
    papel = papelDeValor(perfil?.role);
  }

  const destino = decidirRota(caminho, Boolean(sessao), papel);
  if (!destino) return res;

  const url = req.nextUrl.clone();
  url.pathname = destino;
  url.search = '';
  const redirecionamento = NextResponse.redirect(url);
  for (const c of res.cookies.getAll()) redirecionamento.cookies.set(c);
  return redirecionamento;
}
