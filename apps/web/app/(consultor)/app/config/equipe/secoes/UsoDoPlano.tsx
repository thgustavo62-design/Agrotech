import Link from 'next/link';
import { Cartao } from '@/components/ui';
import { pode } from '@/lib/permissoes';
import type { ContextoEquipe } from '../dados';

/** "X de Y usuários" do plano, com a barra — o limite que o convite e o aceite respeitam. */
export function SecaoUsoDoPlano({ ctx }: { ctx: ContextoEquipe }) {
  const { plano, eu } = ctx;
  const ocupado = plano.usados + plano.reservados;
  const pct = plano.limite ? Math.min(100, Math.round((ocupado / plano.limite) * 100)) : 0;
  return (
    <Cartao olho="Plano" titulo={plano.limite != null ? `${plano.usados} de ${plano.limite} usuário(s) em uso` : `${plano.usados} usuário(s)`}>
      <div className="cfg-uso" data-cheio={plano.cheio}>
        {plano.limite != null ? (
          <div className="cfg-uso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={plano.limite} aria-valuenow={ocupado} aria-label="Usuários do plano">
            <i style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        <small style={{ color: 'var(--grafite)' }}>
          {plano.reservados > 0 ? `${plano.reservados} convite(s) pendente(s) ocupam vaga. ` : ''}
          {plano.nome ? `Plano ${plano.nome}.` : ''}
          {pode(eu?.perfis, 'plano.gerenciar') ? <> <Link href="/app/assinatura">Ver planos</Link></> : null}
        </small>
      </div>
    </Cartao>
  );
}
