import Link from 'next/link';
import { calcular } from '@agrotech/agro-core';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Tag, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';

export function PainelAnalises({ ctx }: { ctx: ContextoProdutor }) {
  const { tabelas, talhoes, totalAnalises } = ctx;

  return (
    totalAnalises === 0 ? (
      <Vazio titulo="Nenhuma análise lançada para este produtor">
        <Link href="/app/analises/nova">Lançar a primeira.</Link>
      </Vazio>
    ) : (
      <div className="lista">
        {talhoes.flatMap((t) => (t.analises ?? []).map((a) => ({ a, t })))
          .sort((x, y) => y.a.data_coleta.localeCompare(x.a.data_coleta))
          .map(({ a, t }) => {
            const r = calcular(paraAnalise(a), tabelas);
            const cult = t.cultura ? tabelas.culturas[t.cultura] : undefined;
            const okV = r.V >= (cult?.V2 ?? 60);
            return (
              <div className="item" key={a.id}>
                <div className="cresce">
                  <h3>{t.nome} — {dataBR(a.data_coleta)}</h3>
                  <small className="mono">{nomeCultura(t.cultura)} · pH {f(Number(a.ph ?? 0), 1)} · V {f(r.V, 0)}% · m {f(r.m, 0)}%</small>
                </div>
                <Tag tom={okV ? 'ok' : 'ruim'}>V {f(r.V, 0)}%</Tag>
                <Link className="btn mini" href={`/app/analises/${a.id}`}>interpretar</Link>
              </div>
            );
          })}
      </div>
    )
  );
}
