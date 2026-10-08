import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual, recarregarPerfil } from '@/lib/supabase/server';
import { garantirEscritorio } from '@/lib/onboarding';
import { contarNaoLidas } from '@/lib/notificacoes';
import { LateralConsultor } from '@/components/lateral-consultor';
import { BarraMobile } from '@/components/barra-mobile';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PaletaComandos } from '@/components/paleta-comandos';
import { SinoNotificacoes } from '@/components/sino-notificacoes';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { LogoIcone } from '@/components/logo';
import { BotaoSair } from '@/components/botao-sair';
import { SincronizadorOffline } from '@/components/sincronizador-offline';
import { AcessoRemovido } from '@/components/acesso-removido';
import { TrocaDeSenhaObrigatoria } from '@/components/troca-de-senha-obrigatoria';
import { nivelDeAutenticacao } from '@/lib/supabase/sessao';

export const dynamic = 'force-dynamic';

/** Guarda de rota da área do consultor. A barreira real continua sendo a RLS. */
export default async function LayoutConsultor({ children }: { children: React.ReactNode }) {
  // as duas consultas não dependem uma da outra: em paralelo (antes uma esperava a outra, ~100 ms cada)
  const sb = await criarClienteServidor();
  const [perfilInicial, naoLidas] = await Promise.all([perfilAtual(), contarNaoLidas(sb)]);
  let perfil = perfilInicial;
  if (!perfil) redirect('/login');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') redirect('/produtor');

  // conta desativada pelo proprietário: nunca abre escritório de teste nem mostra dados
  if (perfil.desativado_em) return <AcessoRemovido />;

  // senha definida pelo proprietário: nada do sistema abre até a pessoa criar a própria (o banco tira a marca ao trocar)
  if (perfil.senha_provisoria) return <TrocaDeSenhaObrigatoria nome={perfil.nome} />;

  // verificação em duas etapas ligada: sessão só com senha (aal1) não passa — e o banco também não entrega dados
  if (perfil.mfa_ativo && (await nivelDeAutenticacao(sb)) !== 'aal2') redirect('/verificar-codigo');

  // primeiro acesso: cria a organização e semeia as tabelas de referência. perfilAtual() é memoizado
  // na requisição e devolveria o perfil velho (sem org) — por isso a releitura sem cache.
  if (!perfil.org_id) {
    await garantirEscritorio();
    perfil = (await recarregarPerfil()) ?? perfil;
  }

  return (
    <div>
      <header className="topo">
        <div className="marca"><LogoIcone />AgroTech <span>Assistência técnica</span></div>
        <PaletaComandos />
        <SinoNotificacoes href="/app/notificacoes" contagem={naoLidas} />
        <div className="quem" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="quem-texto">
            <b>{perfil.nome ?? 'Consultor'}</b>
            {perfil.crea ? `CREA ${perfil.crea}` : 'defina seu CREA em Config.'}
            {' · '}
            <BotaoSair />
          </span>
          <AvatarUsuario nome={perfil.nome} />
        </div>
      </header>
      <div className="app-corpo">
        <LateralConsultor perfis={perfil.perfis} />
        <div className="app-conteudo">
          <main className="vista">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
      <BarraMobile nome={perfil.nome} crea={perfil.crea} perfis={perfil.perfis} />
      <SincronizadorOffline />
    </div>
  );
}
