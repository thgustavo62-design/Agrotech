import { NextResponse } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const sb = await criarClienteServidor();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/produtor/login', req.url));
}
