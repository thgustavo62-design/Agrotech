import { dataBR } from '@/lib/formato';
import { Cartao, Grade, Vazio } from '@/components/ui';
import type { ContextoInteligencia } from '../dados';

export function DeficienciasEProdutoresSemAnalise({ ctx }: { ctx: ContextoInteligencia }) {
  const { produtoresSemAnaliseRecente, deficienciasComuns } = ctx;

  return (
    <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
      <Cartao olho="Diagnóstico" titulo="Deficiências mais comuns">
        {deficienciasComuns.length === 0 ? (
          <Vazio titulo="Nenhum crítico registrado" />
        ) : (
          <div className="lista">
            {deficienciasComuns.map(([txt, n]) => (
              <div className="item" key={txt}>
                <div className="cresce"><p style={{ margin: 0, fontSize: 13 }}>{txt}</p></div>
                <span className="mono nota">{n}×</span>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao olho="Acompanhamento" titulo="Produtores sem análise recente">
        <p className="nota" style={{ margin: '0 0 10px' }}>Mais de 180 dias desde a última coleta (ou nunca coletado).</p>
        {produtoresSemAnaliseRecente.length === 0 ? (
          <Vazio titulo="Todo mundo em dia" />
        ) : (
          <div className="lista">
            {produtoresSemAnaliseRecente.slice(0, 10).map((p) => (
              <div className="item" key={p.nome}>
                <div className="cresce">
                  <h3>{p.nome}</h3>
                  <small>{p.ultimaData ? `última coleta em ${dataBR(p.ultimaData)}` : 'nunca coletou'}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </Grade>
  );
}
