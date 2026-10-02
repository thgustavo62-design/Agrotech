import Link from 'next/link';
import { dataBR } from '@/lib/formato';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { Tag, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';

export function PainelDocumentos({ ctx }: { ctx: ContextoProdutor }) {
  const { documentos } = ctx;

  return (
    documentos.length === 0 ? (
      <Vazio titulo="Nenhum laudo em PDF enviado para este produtor" />
    ) : (
      <div className="lista">
        {documentos.map((d) => {
          const s = ROTULO_STATUS_DOCUMENTO[d.status] ?? { txt: d.status, tom: 'cinza' as const };
          return (
            <div className="item" key={d.id}>
              <div className="cresce">
                <h3>{d.nome_arquivo ?? 'laudo.pdf'}</h3>
                <small>{d.laboratorio ?? 'laboratório não detectado'} · {dataBR(d.criado_em.slice(0, 10))}</small>
              </div>
              <Tag tom={s.tom}>{s.txt}</Tag>
              <Link className="btn sec mini" href={`/app/laudos/${d.id}`}>abrir</Link>
            </div>
          );
        })}
      </div>
    )
  );
}
