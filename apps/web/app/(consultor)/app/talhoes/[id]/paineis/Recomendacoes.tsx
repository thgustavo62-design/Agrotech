import Link from 'next/link';
import { nomeCorretivo, type Recomendacao } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';
import { Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelRecomendacoes({ ctx }: { ctx: ContextoTalhao }) {
  const { recomendacoes } = ctx;

  return (
    recomendacoes.length === 0 ? (
      <Vazio titulo="Nenhuma recomendação emitida para este talhão" />
    ) : (
      <div className="lista">
        {recomendacoes.map((r) => {
          const res = r.resultado as Partial<Recomendacao> & Record<string, unknown>;
          const cal = res.calagem as { corrigido?: number } | undefined;
          const corretivo = res.corretivo as { corretivo?: string } | undefined;
          const ad = res.adubacao as { N?: number; P2O5?: number; K2O?: number } | undefined;
          return (
            <div className="item" key={r.id}>
              <div className="cresce">
                <h3>Emitida em {dataBR(r.emitida_em.slice(0, 10))}</h3>
                <small className="mono">
                  {cal?.corrigido != null ? `calcário ${f(cal.corrigido, 1)} t/ha` : ''}
                  {corretivo?.corretivo ? ` (${nomeCorretivo(corretivo.corretivo as never).toLowerCase()})` : ''}
                  {ad ? ` · N ${ad.N} · P₂O₅ ${ad.P2O5} · K₂O ${ad.K2O} kg/ha` : ''}
                </small>
              </div>
              <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
            </div>
          );
        })}
      </div>
    )
  );
}
