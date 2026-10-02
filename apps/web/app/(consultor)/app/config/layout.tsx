import { perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { CabecalhoVista } from '@/components/ui';
import { SubNavConfig } from './sub-nav';

/** Casca da central de configurações: título + menu lateral (abas no celular) + a seção escolhida. */
export default async function LayoutConfig({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  return (
    <>
      <CabecalhoVista
        olho="Configurações"
        titulo="Conta e escritório"
        descricao="Seus dados, o escritório e quem da equipe acessa o painel — com o que cada pessoa pode fazer."
      />
      <div className="cfg">
        <SubNavConfig verPlano={pode(perfil?.perfis, 'plano.gerenciar')} />
        <div className="cfg-conteudo">{children}</div>
      </div>
    </>
  );
}
