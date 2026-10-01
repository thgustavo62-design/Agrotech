import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { decidirRota, ehFalhaTransitoria, ehPublica, papelDoToken, type Papel } from './rotas';

type CookieParaGravar = { name: string; value: string; options?: CookieOptions };

/**
 * Renova a sessão e roteia por perfil. É CONVENIÊNCIA de navegação — a barreira
 * real é a RLS no banco (doc §5.5). As regras estão em ./rotas.ts (testadas).
 *
 * Cuidados que já custaram o login do usuário:
 *  - o redirect carrega os cookies que a renovação acabou de gravar; sem isso o refresh
 *    token antigo (já consumido) continua no navegador e a sessão morre;
 *  - falha momentânea do Auth (rede, 5xx, 429) não vira "sem sessão";
 *  - o papel vem do claim do token (sem consulta ao banco por requisição).
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
  let user = null;
  let transitoria = false;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data, error } = await sb.auth.getUser();
    user = data.user;
    transitoria = !user && ehFalhaTransitoria(error);
    if (!transitoria) break;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  // Auth fora do ar não é "deslogado": segue; o guarda do layout e a RLS protegem de qualquer modo
  if (transitoria) return res;

  let papel: Papel = null;
  if (user) {
    const { data: { session } } = await sb.auth.getSession();
    papel = papelDoToken(session?.access_token);
    if (!papel) {
      // token antigo, sem o claim: cai para o perfil
      const { data: perfil } = await sb.schema('agro').from('profiles').select('role').eq('id', user.id).maybeSingle();
      const r = perfil?.role;
      papel = r === 'consultor' || r === 'admin' || r === 'produtor' ? r : null;
    }
  }

  const destino = decidirRota(caminho, Boolean(user), papel);
  if (!destino) return res;

  const url = req.nextUrl.clone();
  url.pathname = destino;
  url.search = '';
  const redirecionamento = NextResponse.redirect(url);
  for (const c of res.cookies.getAll()) redirecionamento.cookies.set(c);
  return redirecionamento;
}
