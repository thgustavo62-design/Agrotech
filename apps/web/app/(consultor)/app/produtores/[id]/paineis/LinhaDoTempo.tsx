import Link from 'next/link';
import { dataBR } from '@/lib/formato';
import { rotuloAtividade, linkAtividade } from '@/lib/atividade';
import { Cartao, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';

export function PainelLinhaDoTempo({ ctx }: { ctx: ContextoProdutor }) {
  const { atividade } = ctx;

  return (
    atividade.length === 0 ? (
      <Vazio titulo="Nada registrado ainda para este produtor" />
    ) : (
      <Cartao olho="Prontuário" titulo="Linha do tempo">
        <div className="lista">
          {atividade.map((a, i) => {
            const href = linkAtividade(a);
            return (
              <div className="item" key={i}>
                <div className="cresce">
                  <h3 style={{ fontSize: 13.5 }}>{rotuloAtividade(a)}</h3>
                  <small>{dataBR(a.criado_em.slice(0, 10))} às {a.criado_em.slice(11, 16)}</small>
                </div>
                {href ? <Link className="btn sec mini" href={href}>abrir</Link> : null}
              </div>
            );
          })}
        </div>
      </Cartao>
    )
  );
}
