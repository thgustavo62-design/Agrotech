import Link from 'next/link';
import { dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { Cartao, Grade, Tag, Vazio } from '@/components/ui';
import type { ContextoInicioProdutor } from '../dados';

export function RecomendacoesEDocumentos({ ctx }: { ctx: ContextoInicioProdutor }) {
  const { recomendacoes, documentos } = ctx;

  return (
    <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
      <Cartao olho="Histórico" titulo="Últimas recomendações">
        {recomendacoes.length === 0 ? (
          <Vazio titulo="Nenhuma recomendação ainda" />
        ) : (
          <div className="lista">
            {recomendacoes.map((r) => (
              <div className="item" key={r.id}>
                <div className="cresce">
                  <h3>{r.analise?.talhao?.nome ?? 'Talhão'}</h3>
                  <small>{nomeCultura(r.analise?.talhao?.cultura ?? null)} · {dataBR(r.emitida_em.slice(0, 10))}</small>
                </div>
                <Link className="btn sec mini" href={`/produtor/laudos/${r.id}`}>abrir</Link>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao olho="Recebidos" titulo="Documentos recentes">
        {documentos.length === 0 ? (
          <Vazio titulo="Nenhum documento ainda" />
        ) : (
          <div className="lista">
            {documentos.map((d) => {
              const s = ROTULO_STATUS_DOCUMENTO[d.status] ?? { txt: d.status, tom: 'cinza' as const };
              return (
                <div className="item" key={d.id}>
                  <div className="cresce">
                    <h3>{d.nome_arquivo ?? 'laudo.pdf'}</h3>
                    <small>{d.laboratorio ?? 'laboratório não identificado'} · {dataBR(d.criado_em.slice(0, 10))}</small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </Grade>
  );
}
