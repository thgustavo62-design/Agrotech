import { NextRequest } from 'next/server';
import { atualizarSessao } from '@/lib/supabase/middleware';
import { montarCsp, novoNonce } from '@/lib/csp';

export async function middleware(req: NextRequest) {
  // CSP com nonce por requisição: o Next lê o nonce do cabeçalho da REQUISIÇÃO e o põe nos próprios scripts;
  // o navegador recebe a mesma política no cabeçalho da RESPOSTA (lib/csp.ts).
  const nonce = novoNonce();
  const csp = montarCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    desenvolvimento: process.env.NODE_ENV !== 'production',
  });
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set('content-security-policy', csp);
  cabecalhos.set('x-nonce', nonce);

  const res = await atualizarSessao(new NextRequest(req, { headers: cabecalhos }));
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // tudo, menos assets estáticos e imagem
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
