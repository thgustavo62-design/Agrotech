import { redirect } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { contarNaoLidas } from '@/lib/notificacoes';
import { NavProdutor } from '@/components/nav-produtor';
import { SinoNotificacoes } from '@/components/sino-notificacoes';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { LogoIcone } from '@/components/logo';

export const dynamic = 'force-dynamic';

/** Guarda da área do produtor. A barreira real é a RLS (policies *_produtor). */
export default async function LayoutProdutor({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/produtor/login');
  if (perfil.role !== 'produtor') redirect('/app');

  const sb = await criarClienteServidor();
  const naoLidas = await contarNaoLidas(sb);

  return (
    <div>
      <header className="topo" style={{ flexWrap: 'wrap', rowGap: 10 }}>
        <div className="marca"><LogoIcone />AgroTech <span>Sua lavoura</span></div>
        <div className="quem" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SinoNotificacoes href="/produtor/notificacoes" contagem={naoLidas} />
          <span>
            <b style={{ display: 'block' }}>{perfil.nome ?? 'Produtor'}</b>
            <Link href="/produtor/sair" style={{ color: '#7fc6a3' }}>sair</Link>
          </span>
          <AvatarUsuario nome={perfil.nome} />
        </div>
        <div style={{ flexBasis: '100%', order: 3 }}>
          <NavProdutor />
        </div>
      </header>
      <main className="vista">{children}</main>
    </div>
  );
}
