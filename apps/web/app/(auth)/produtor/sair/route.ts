import { NextResponse } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';

/** Logout é POST: ver components/botao-sair.tsx. 303 para o navegador seguir com GET. */
export async function POST(req: Request) {
  const sb = await criarClienteServidor();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/login?site=assistencia&como=produtor', req.url), 303);
}

/** GET NÃO encerra a sessão: o pré-carregamento do Next e links externos fazem GET. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL('/login?site=assistencia&como=produtor', req.url));
}
