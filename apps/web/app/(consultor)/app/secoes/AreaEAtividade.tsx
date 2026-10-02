import Link from 'next/link';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { rotuloAtividade, linkAtividade } from '@/lib/atividade';
import { Cartao, Grade, Vazio } from '@/components/ui';
import type { ContextoPainel } from '../dados';

export function AreaEAtividade({ ctx }: { ctx: ContextoPainel }) {
  const { p, culturas } = ctx;

  return (
    <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
      {culturas.length > 0 && (
        <Cartao olho="Composição" titulo="Área por cultura">
          <div className="lista">
            {culturas.map(([c, area]) => {
              const pct = p.area_total > 0 ? (100 * area) / p.area_total : 0;
              return (
                <div className="item" key={c}>
                  <div className="cresce">
                    <h3>{nomeCultura(c)}</h3>
                    <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, marginTop: 6 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--folha)', borderRadius: 99 }} />
                    </div>
                  </div>
                  <span className="mono nota">{f(area, 1)} ha · {f(pct, 0)}%</span>
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

      <Cartao olho="Prontuário do escritório" titulo="Atividade recente">
        {p.atividade_recente.length === 0 ? (
          <Vazio titulo="Nada registrado ainda" />
        ) : (
          <div className="lista">
            {p.atividade_recente.map((a, i) => {
              const rotulo = rotuloAtividade(a);
              const href = linkAtividade(a);
              return (
                <div className="item" key={i}>
                  <div className="cresce">
                    <h3 style={{ fontSize: 13.5 }}>{rotulo}</h3>
                    <small>{dataBR(a.criado_em.slice(0, 10))} às {a.criado_em.slice(11, 16)}</small>
                  </div>
                  {href ? <Link className="btn sec mini" href={href}>abrir</Link> : null}
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </Grade>
  );
}
