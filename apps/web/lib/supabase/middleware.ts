import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieParaGravar = { name: string; value: string; options?: CookieOptions };

/**
 * Renova a sessão e roteia por perfil. É CONVENIÊNCIA de navegação — a barreira
 * real é a RLS no banco (doc §5.5).
 *
 *   /app/*      exige role consultor ou admin
 *   /produtor/* (exceto /produtor/login e /produtor/aceitar) exige role produtor
 */
export async function atualizarSessao(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // sem Supabase configurado (preview / vitrine) o middleware apenas passa
  if (!supaUrl || !supaKey) return res;

  // rotas públicas: vitrine e link de resultados do produtor
  const caminho = req.nextUrl.pathname;
  if (caminho.startsWith('/demo') || caminho.startsWith('/r/')) return res;

  const sb = createServerClient(
    supaUrl,
    supaKey,
    {
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
    },
  );

  const { data: { user } } = await sb.auth.getUser();

  // startsWith puro colide com rotas irmãs que só compartilham o prefixo de texto
  // (ex.: "/apple-icon" começa com "/app" sem ser a área do consultor) — por
  // isso confere limite de segmento (== ou seguido de "/").
  const areaConsultor = caminho === '/app' || caminho.startsWith('/app/');
  const areaProdutor =
    (caminho === '/produtor' || caminho.startsWith('/produtor/')) &&
    !caminho.startsWith('/produtor/login') &&
    !caminho.startsWith('/produtor/aceitar');

  if (!user && (areaConsultor || areaProdutor)) {
    const url = req.nextUrl.clone();
    url.pathname = areaProdutor ? '/produtor/login' : '/login';
    return NextResponse.redirect(url);
  }

  if (user && (areaConsultor || areaProdutor)) {
    const { data: perfil } = await sb
      .schema('agro').from('profiles').select('role').eq('id', user.id).single();
    const role = perfil?.role;

    if (areaConsultor && role !== 'consultor' && role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/produtor';
      return NextResponse.redirect(url);
    }
    if (areaProdutor && role !== 'produtor') {
      const url = req.nextUrl.clone();
      url.pathname = '/app';
      return NextResponse.redirect(url);
    }
  }

  return res;
}
