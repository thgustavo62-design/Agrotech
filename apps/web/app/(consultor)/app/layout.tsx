import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { garantirEscritorio } from '@/lib/onboarding';
import { contarNaoLidas } from '@/lib/notificacoes';
import { LateralConsultor } from '@/components/lateral-consultor';
import { BarraMobile } from '@/components/barra-mobile';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PaletaComandos } from '@/components/paleta-comandos';
import { SinoNotificacoes } from '@/components/sino-notificacoes';
import { AvatarUsuario } from '@/components/avatar-usuario';

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

  const sb = await criarClienteServidor();
  const naoLidas = await contarNaoLidas(sb);

  return (
    <div>
      <header className="topo">
        <div className="marca">AgroTech <span>Assistência técnica</span></div>
        <PaletaComandos />
        <SinoNotificacoes href="/app/notificacoes" contagem={naoLidas} />
        <div className="quem" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            <b>{perfil.nome ?? 'Consultor'}</b>
            {perfil.crea ? `CREA ${perfil.crea}` : 'defina seu CREA em Config.'}
          </span>
          <AvatarUsuario nome={perfil.nome} />
        </div>
      </header>
      <div className="app-corpo">
        <LateralConsultor />
        <div className="app-conteudo">
          <main className="vista">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
      <BarraMobile />
    </div>
  );
}
