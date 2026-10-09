import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { destinoDoSite, loginDoSite, siteDeValor } from '@/lib/sites';
import { papelDeValor } from '@/lib/supabase/rotas';

export const dynamic = 'force-dynamic';

/**
 * Porta de entrada: o login manda para cá com `?site=` e esta página decide o destino pelo site escolhido e pelo papel da conta.
 * Sem login volta para a tela de entrada, já no site pedido.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const site = siteDeValor((await searchParams).site);
  const perfil = await perfilAtual();
  if (!perfil) redirect(loginDoSite(site));
  redirect(destinoDoSite(site, papelDeValor(perfil.role)) ?? loginDoSite(site));
}
