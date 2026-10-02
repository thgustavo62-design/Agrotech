import Link from 'next/link';
import { nomeCorretivo, type Corretivo } from '@agrotech/agro-core';
import { nomeCultura } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Tag, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';

export function PainelRecomendacoes({ ctx }: { ctx: ContextoProdutor }) {
  const { recomendacoes } = ctx;

  return (
    recomendacoes.length === 0 ? (
      <Vazio titulo="Nenhuma recomendação emitida para este produtor" />
    ) : (
      <div className="lista">
        {recomendacoes.map((r) => {
          const res = r.resultado;
          const cal = res.calagem as { corrigido?: number } | undefined;
          const corretivo = res.corretivo as { corretivo?: Corretivo } | undefined;
          const ad = res.adubacao as { N?: number; P2O5?: number; K2O?: number } | undefined;
          return (
            <div className="item" key={r.id}>
              <div className="cresce">
                <h3>{r.analise?.talhao?.nome ?? 'Talhão removido'}</h3>
                <small className="mono">
                  {nomeCultura(r.analise?.talhao?.cultura ?? null)} · emitida em {dataBR(r.emitida_em.slice(0, 10))}
                  {cal?.corrigido != null ? ` · calcário ${f(cal.corrigido, 1)} t/ha` : ''}
                  {corretivo?.corretivo ? ` (${nomeCorretivo(corretivo.corretivo).toLowerCase()})` : ''}
                  {ad ? ` · N ${ad.N} P₂O₅ ${ad.P2O5} K₂O ${ad.K2O}` : ''}
                </small>
              </div>
              <Tag tom="cinza">motor {r.motor_versao}</Tag>
              <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
            </div>
          );
        })}
      </div>
    )
  );
}
