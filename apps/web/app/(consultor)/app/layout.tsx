import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { garantirEscritorio } from '@/lib/onboarding';
import { NavAbas } from '@/components/nav-abas';

export const dynamic = 'force-dynamic';

/** Guarda de rota da área do consultor. A barreira real continua sendo a RLS. */
export default async function LayoutConsultor({ children }: { children: React.ReactNode }) {
  let perfil = await perfilAtual();
  if (!perfil) redirect('/login');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') redirect('/produtor');

  // primeiro acesso: cria a organização e semeia as tabelas de referência
  if (!perfil.org_id) {
    await garantirEscritorio();
    perfil = (await perfilAtual()) ?? perfil;
  }

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
