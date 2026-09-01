import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { NavAbas } from '@/components/nav-abas';

/** Guarda de rota da área do consultor. A barreira real continua sendo a RLS. */
export default async function LayoutConsultor({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/login');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') redirect('/produtor');

  return (
    <div>
      <header className="topo">
        <div className="marca">AgroTech <span>Assistência técnica</span></div>
        <div className="quem">
          <b>{perfil.nome ?? 'Consultor'}</b>
          {perfil.crea ? `CREA ${perfil.crea}` : 'defina seu CREA em Tabelas'}
        </div>
      </header>
      <NavAbas />
      <main className="vista">{children}</main>
    </div>
  );
}
