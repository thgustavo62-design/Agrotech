import type { NextRequest } from 'next/server';
import { atualizarSessao } from '@/lib/supabase/middleware';

export async function middleware(req: NextRequest) {
  return atualizarSessao(req);
}

export const config = {
  matcher: [
    // tudo, menos assets estáticos e imagem
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
