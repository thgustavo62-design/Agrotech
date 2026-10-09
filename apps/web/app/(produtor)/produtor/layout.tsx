import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { contarNaoLidas } from '@/lib/notificacoes';
import { NavProdutor } from '@/components/nav-produtor';
import { SinoNotificacoes } from '@/components/sino-notificacoes';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { LogoIcone } from '@/components/logo';
import { BotaoSair } from '@/components/botao-sair';
import { BarraProdutor } from '@/components/barra-produtor';

export const dynamic = 'force-dynamic';

/** Guarda da área do produtor. A barreira real é a RLS (policies *_produtor). */
export default async function LayoutProdutor({ children }: { children: React.ReactNode }) {
  const sb = await criarClienteServidor();
  const [perfil, naoLidas] = await Promise.all([perfilAtual(), contarNaoLidas(sb)]);
  if (!perfil) redirect('/produtor/login');
  if (perfil.role !== 'produtor') redirect('/app');

  return (
    <div>
      <header className="topo" style={{ flexWrap: 'wrap', rowGap: 10 }}>
        <div className="marca"><LogoIcone />AgroTech <span>Sua lavoura</span></div>
        <div className="quem" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SinoNotificacoes href="/produtor/notificacoes" contagem={naoLidas} />
          <span className="quem-texto">
            <b style={{ display: 'block' }}>{perfil.nome ?? 'Produtor'}</b>
            <Link href="/sites" className="link-sair">trocar de site</Link>{' · '}
            <BotaoSair action="/produtor/sair" />
          </span>
          <AvatarUsuario nome={perfil.nome} />
        </div>
        {/* no celular o menu vai para a barra inferior (BarraProdutor) */}
        <div className="nav-produtor-topo" style={{ flexBasis: '100%', order: 3 }}>
          <NavProdutor />
        </div>
      </header>
      <main className="vista">{children}</main>
      <BarraProdutor nome={perfil.nome} />
    </div>
  );
}
