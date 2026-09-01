import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Renova a sessão e roteia por perfil. É CONVENIÊNCIA de navegação — a barreira
 * real é a RLS no banco (doc §5.5).
 *
 *   /app/*      exige role consultor ou admin
 *   /produtor/* (exceto /produtor/login e /produtor/aceitar) exige role produtor
 */
export async function atualizarSessao(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) res.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data: { user } } = await sb.auth.getUser();
  const { pathname } = req.nextUrl;

  const areaConsultor = pathname.startsWith('/app');
  const areaProdutor =
    pathname.startsWith('/produtor') &&
    !pathname.startsWith('/produtor/login') &&
    !pathname.startsWith('/produtor/aceitar');

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
