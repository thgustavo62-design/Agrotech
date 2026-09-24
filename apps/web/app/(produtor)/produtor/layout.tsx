import { redirect } from 'next/navigation';
import Link from 'next/link';
import { perfilAtual } from '@/lib/supabase/server';
import { NavProdutor } from '@/components/nav-produtor';

export const dynamic = 'force-dynamic';

/** Guarda da área do produtor. A barreira real é a RLS (policies *_produtor). */
export default async function LayoutProdutor({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/produtor/login');
  if (perfil.role !== 'produtor') redirect('/app');

  return (
    <div>
      <header className="topo" style={{ flexWrap: 'wrap', rowGap: 10 }}>
        <div className="marca">AgroTech <span>Sua lavoura</span></div>
        <div className="quem">
          <b>{perfil.nome ?? 'Produtor'}</b>
          <Link href="/produtor/sair" style={{ color: '#7fc6a3' }}>sair</Link>
        </div>
        <div style={{ flexBasis: '100%', order: 3 }}>
          <NavProdutor />
        </div>
      </header>
      <main className="vista">{children}</main>
    </div>
  );
}
