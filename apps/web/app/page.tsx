import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';

export default async function Home() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/login');
  redirect(perfil.role === 'produtor' ? '/produtor' : '/app');
}
