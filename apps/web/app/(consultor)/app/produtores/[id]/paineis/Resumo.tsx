import Link from 'next/link';
import { nomeCultura } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';
import { SITUACAO } from '../dados';

export function PainelResumo({ ctx }: { ctx: ContextoProdutor }) {
  const { talhoes, resumos, porCultura, culturasOrdenadas, areaTotal, totalAnalises, nCritico, nAtencao, ultimaVisita, proximaVisita, recomendacoes, seta } = ctx;

  return (
    (
      <>
        <Grade cols={4}>
          <Metrica rotulo="Culturas" valor={culturasOrdenadas.filter((c) => c !== '__sem').length} />
          <Metrica rotulo="Talhões" valor={talhoes.length} />
          <Metrica rotulo="Área" valor={`${f(areaTotal, 1)} ha`} />
          <Metrica rotulo="Análises" valor={totalAnalises} />
        </Grade>

        {(nCritico > 0 || nAtencao > 0) && (
          <Cartao olho="Fila de trabalho" titulo="Alertas deste produtor" style={{ marginTop: 14 }}>
            <div className="lista">
              {resumos.filter((x) => x.situacao === 'precisa_correcao' || x.situacao === 'atencao').map((x) => {
                const s = SITUACAO[x.situacao];
                return (
                  <div className="item" key={x.talhao.id}>
                    <div className="cresce">
                      <h3>{x.talhao.nome}</h3>
                      <small>{nomeCultura(x.talhao.cultura)}{x.r ? ` · V ${f(x.r.V, 0)}% · m ${f(x.r.m, 0)}%` : ''}</small>
                    </div>
                    <Tag tom={s.tom}>{s.txt}</Tag>
                    <Link className="btn sec mini" href={`/app/talhoes/${x.talhao.id}`}>abrir</Link>
                  </div>
                );
              })}
            </div>
          </Cartao>
        )}

        <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
          {culturasOrdenadas.length > 0 && (
            <Cartao olho="Composição" titulo="Área por cultura">
              <div className="lista">
                {culturasOrdenadas.filter((c) => c !== '__sem').map((c) => {
                  const grupo = porCultura.get(c)!;
                  const area = grupo.reduce((s, x) => s + Number(x.talhao.area_ha ?? 0), 0);
                  const pct = areaTotal > 0 ? (100 * area) / areaTotal : 0;
                  return (
                    <div className="item" key={c}>
                      <div className="cresce">
                        <h3>{nomeCultura(c)}</h3>
                        <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, marginTop: 6 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--folha)', borderRadius: 99 }} />
                        </div>
                      </div>
                      <span className="mono nota">{f(area, 1)} ha</span>
                    </div>
                  );
                })}
              </div>
            </Cartao>
          )}

          <Cartao olho="Fertilidade" titulo="Últimas análises">
            {resumos.filter((x) => x.ultima).length === 0 ? (
              <Vazio titulo="Nenhuma análise lançada" />
            ) : (
              <div className="lista">
                {[...resumos].filter((x) => x.ultima)
                  .sort((a, b) => b.ultima!.data_coleta.localeCompare(a.ultima!.data_coleta))
                  .slice(0, 5)
                  .map((x) => (
                    <div className="item" key={x.talhao.id}>
                      <div className="cresce">
                        <h3>{x.talhao.nome}</h3>
                        <small className="mono">
                          {dataBR(x.ultima!.data_coleta)} · V {f(x.r!.V, 0)}%{seta(x.r!.V, x.rAnterior?.V)} · pH {f(Number(x.ultima!.ph ?? 0), 1)}{seta(Number(x.ultima!.ph ?? 0), x.anterior ? Number(x.anterior.ph ?? 0) : undefined)}
                        </small>
                      </div>
                      <Link className="btn sec mini" href={`/app/analises/${x.ultima!.id}`}>abrir</Link>
                    </div>
                  ))}
              </div>
            )}
            <p className="nota" style={{ marginTop: 10 }}>▲ subiu · ▼ caiu · – estável, frente à coleta anterior do mesmo talhão.</p>
          </Cartao>
        </Grade>

        {(recomendacoes.length > 0 || proximaVisita || ultimaVisita) && (
          <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
            <Cartao olho="Recomendações" titulo="Em aberto">
              {recomendacoes.length === 0 ? <Vazio titulo="Nenhuma emitida ainda" /> : (
                <div className="lista">
                  {recomendacoes.slice(0, 3).map((r) => (
                    <div className="item" key={r.id}>
                      <div className="cresce">
                        <h3>{r.analise?.talhao?.nome ?? 'Talhão'}</h3>
                        <small>emitida em {dataBR(r.emitida_em.slice(0, 10))}</small>
                      </div>
                      <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>
            <Cartao olho="Caderno de campo" titulo="Próximos serviços">
              {!proximaVisita && !ultimaVisita ? <Vazio titulo="Nenhuma visita registrada" /> : (
                <p className="nota" style={{ margin: 0 }}>
                  {ultimaVisita ? `Última visita em ${dataBR(ultimaVisita.data)}.` : 'Nenhuma visita realizada ainda.'}{' '}
                  {proximaVisita ? `Próxima prevista para ${dataBR(proximaVisita)}.` : ''}
                </p>
              )}
            </Cartao>
          </Grade>
        )}
      </>
    )
  );
}
