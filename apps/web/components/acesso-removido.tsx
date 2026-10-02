import { BotaoSair } from '@/components/botao-sair';
import { LogoIcone } from '@/components/logo';

/** Tela de quem teve o acesso removido pelo proprietário do escritório (migration 0039). */
export function AcessoRemovido() {
  return (
    <main className="vista" style={{ maxWidth: 520, margin: '12vh auto', textAlign: 'center' }}>
      <LogoIcone />
      <h1 style={{ margin: '18px 0 8px' }}>Seu acesso foi removido</h1>
      <p className="nota" style={{ margin: '0 0 18px' }}>
        O proprietário do escritório desativou esta conta. Se isso foi um engano, peça a ele que cadastre você de novo.
      </p>
      <BotaoSair className="btn" rotulo="Sair" />
    </main>
  );
}
