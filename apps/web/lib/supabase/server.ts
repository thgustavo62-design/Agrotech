import { cache } from 'react';
import { lerSessao } from './sessao';
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

/**
 * Perfil do usuário logado (id, role, org_id). null se não houver sessão.
 * `cache` memoiza por requisição: layout + página + ações chamavam isto várias vezes, e cada
 * chamada era uma ida ao Auth (getUser valida o token no servidor) mais uma consulta a profiles.
 */
export const perfilAtual = cache(carregarPerfil);

/** Igual a `perfilAtual`, mas ignora a memoização: use depois de mudar o perfil na MESMA requisição. */
export const recarregarPerfil = carregarPerfil;

async function carregarPerfil() {
  const sb = await criarClienteServidor();
  const { sessao } = await lerSessao(sb);
  if (!sessao) return null;

  const { data } = await sb
    .schema('agro')
    .from('profiles')
    .select('id, role, org_id, nome, crea')
    .eq('id', sessao.id)
    .single();

  return data;
}

/** Linha de `agro.produtores` do usuário logado (quando ele é o próprio produtor). null caso contrário. */
export const produtorAtual = cache(async () => {
  const sb = await criarClienteServidor();
  const { sessao } = await lerSessao(sb);
  if (!sessao) return null;

  const { data } = await sb
    .schema('agro')
    .from('produtores')
    .select('id, nome')
    .eq('user_id', sessao.id)
    .maybeSingle();

  return data;
});
