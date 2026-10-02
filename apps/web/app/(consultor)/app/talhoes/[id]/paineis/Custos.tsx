import { Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelCustos({ ctx }: { ctx: ContextoTalhao }) {
  return (
    (
      <Vazio titulo="Custos não ficam visíveis pra você, por padrão">
        O financeiro do produtor (<code>financeiro_lancamentos</code>) é isolado por desenho — nenhum
        consultor tem acesso, nem leitura, salvo se o produtor decidir compartilhar explicitamente algum
        dia (ainda não existe essa opção). Não é uma tela que falta construir.
      </Vazio>
    )
  );
}
