import Link from 'next/link';
import { dataBR } from '@/lib/formato';
import { Cartao, Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelHistorico({ ctx }: { ctx: ContextoTalhao }) {
  const { timeline } = ctx;

  return (
    timeline.length === 0 ? (
      <Vazio titulo="Nada registrado ainda para este talhão" />
    ) : (
      <Cartao olho="Prontuário" titulo="Linha do tempo">
        <div className="lista">
          {timeline.map((ev, i) => (
            <div className="item" key={i}>
              <div className="cresce">
                <h3>{dataBR(ev.data)}</h3>
                <small>{ev.rotulo}</small>
              </div>
              {ev.href ? <Link className="btn sec mini" href={ev.href}>abrir</Link> : null}
            </div>
          ))}
        </div>
      </Cartao>
    )
  );
}
