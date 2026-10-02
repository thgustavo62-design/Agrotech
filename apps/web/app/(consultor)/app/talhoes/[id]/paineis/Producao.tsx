import { f, dataBR } from '@/lib/formato';
import { Cartao, Tag, Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelProducao({ ctx }: { ctx: ContextoTalhao }) {
  const { producao } = ctx;

  return (
    producao.length === 0 ? (
      <Vazio titulo="Nenhum registro de produção para este talhão">
        O produtor ainda não lançou nada em <code>/produtor/producao</code>.
      </Vazio>
    ) : (
      <Cartao olho="Só campos agronômicos — preço e receita ficam com o produtor" titulo="Prevista × realizada">
        <div className="lista">
          {producao.map((p) => {
            const pct = p.producao_prevista ? (100 * Number(p.producao_realizada ?? 0)) / Number(p.producao_prevista) : null;
            return (
              <div className="item" key={p.id}>
                <div className="cresce">
                  <h3>{dataBR(p.criado_em.slice(0, 10))}</h3>
                  <small className="mono">
                    {p.producao_prevista != null ? `previsto ${f(Number(p.producao_prevista), 1)} ${p.unidade}` : 'sem previsão'}
                    {p.producao_realizada != null ? ` · realizado ${f(Number(p.producao_realizada), 1)} ${p.unidade}` : ''}
                  </small>
                </div>
                {pct != null ? (
                  <Tag tom={pct >= 90 ? 'ok' : pct >= 60 ? 'alerta' : 'ruim'}>{f(pct, 0)}%</Tag>
                ) : null}
              </div>
            );
          })}
        </div>
      </Cartao>
    )
  );
}
