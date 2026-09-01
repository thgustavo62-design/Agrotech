import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieParaGravar = { name: string; value: string; options?: CookieOptions };

/** Cliente Supabase para Server Components / Route Handlers. RLS aplicada. */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieParaGravar[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // chamado de Server Component — o middleware cuida de renovar a sessão
          }
        },
      },
    },
  );
}

/** Perfil do usuário logado (id, role, org_id). null se não houver sessão. */
export async function perfilAtual() {
  const sb = await criarClienteServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .schema('agro')
    .from('profiles')
    .select('id, role, org_id, nome, crea')
    .eq('id', user.id)
    .single();

  return data;
}
