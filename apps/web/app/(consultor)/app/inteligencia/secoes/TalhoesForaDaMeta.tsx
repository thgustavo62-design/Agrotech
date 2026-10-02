import Link from 'next/link';
import { nomeCultura } from '@/lib/culturas';
import { f } from '@/lib/formato';
import { Cartao, Tag, Vazio } from '@/components/ui';
import type { ContextoInteligencia } from '../dados';

export function TalhoesForaDaMeta({ ctx }: { ctx: ContextoInteligencia }) {
  const { ROTULO_SITUACAO, foraDaMeta } = ctx;

  return (
    <Cartao olho="Fila de correção" titulo="Talhões fora da meta" style={{ marginTop: 14 }}>
      {foraDaMeta.length === 0 ? (
        <Vazio titulo="Nada fora da meta na carteira" />
      ) : (
        <div className="lista">
          {foraDaMeta.slice(0, 15).map((x) => {
            const s = ROTULO_SITUACAO[x.situacao]!;
            return (
              <div className="item" key={x.talhao.id}>
                <div className="cresce">
                  <h3>{x.talhao.nome}</h3>
                  <small>
                    {x.talhao.propriedade?.produtor?.nome ?? '—'} · {nomeCultura(x.talhao.cultura)}
                    {x.r ? ` · V ${f(x.r.V, 0)}% · m ${f(x.r.m, 0)}%` : ''}
                  </small>
                </div>
                <Tag tom={s.tom}>{s.txt}</Tag>
                <Link className="btn sec mini" href={`/app/talhoes/${x.talhao.id}`}>abrir</Link>
              </div>
            );
          })}
        </div>
      )}
      {foraDaMeta.length > 15 && <p className="nota" style={{ marginTop: 10 }}>+{foraDaMeta.length - 15} outro(s).</p>}
    </Cartao>
  );
}
