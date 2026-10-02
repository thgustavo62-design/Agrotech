import { dataBR, moeda } from '@/lib/formato';
import { Cartao, Grade, Metrica, Vazio } from '@/components/ui';
import { mudarStatusLancamentoEscritorio } from '../acoes';
import type { ContextoFinanceiroEscritorio } from '../dados';

export function PainelResumo({ ctx }: { ctx: ContextoFinanceiroEscritorio }) {
  const { nomeCategoria, saldoGeral, receitasMes, despesasMes, despesasCategoriaOrdenadas, atrasados, proximosVencimentos, pendenciasTotal } = ctx;

  return (
    (
      <>
        <Grade cols={4}>
          <Metrica rotulo="Saldo em caixa" valor={moeda(saldoGeral)} />
          <Metrica rotulo="Receitas no mês" valor={moeda(receitasMes)} cor="var(--c-mbom)" />
          <Metrica rotulo="Despesas no mês" valor={moeda(despesasMes)} cor={despesasMes > 0 ? 'var(--c-mb)' : undefined} />
          <Metrica rotulo="Pendências" valor={pendenciasTotal} cor={pendenciasTotal ? 'var(--c-b)' : undefined} />
        </Grade>

        {atrasados.length > 0 && (
          <Cartao olho="Atenção" titulo="Lançamentos atrasados" style={{ marginTop: 14 }}>
            <div className="lista">
              {atrasados.slice(0, 8).map((l) => (
                <div className="item" key={l.id}>
                  <div className="cresce">
                    <h3>{l.descricao}</h3>
                    <small>venceu em {dataBR(l.vencimento)} · {nomeCategoria(l.categoria_id)}</small>
                  </div>
                  <span className="mono" style={{ color: l.tipo === 'despesa' ? 'var(--c-mb)' : 'var(--c-mbom)' }}>
                    {moeda(Number(l.valor))}
                  </span>
                  <form action={mudarStatusLancamentoEscritorio}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="status" value="pago" />
                    <button className="btn sec mini" type="submit">marcar pago</button>
                  </form>
                </div>
              ))}
            </div>
          </Cartao>
        )}

        <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
          {despesasCategoriaOrdenadas.length > 0 && (
            <Cartao olho="Este mês" titulo="Despesas por categoria">
              <div className="lista">
                {despesasCategoriaOrdenadas.map(([catId, valor]) => {
                  const pct = despesasMes > 0 ? (100 * valor) / despesasMes : 0;
                  return (
                    <div className="item" key={catId}>
                      <div className="cresce">
                        <h3>{catId === '__sem' ? 'Sem categoria' : nomeCategoria(catId)}</h3>
                        <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, marginTop: 6 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--c-mb)', borderRadius: 99 }} />
                        </div>
                      </div>
                      <span className="mono nota">{moeda(valor)}</span>
                    </div>
                  );
                })}
              </div>
            </Cartao>
          )}

          <Cartao olho="A vencer" titulo="Próximos vencimentos">
            {proximosVencimentos.length === 0 ? (
              <Vazio titulo="Nada a vencer" />
            ) : (
              <div className="lista">
                {proximosVencimentos.map((l) => (
                  <div className="item" key={l.id}>
                    <div className="cresce">
                      <h3>{l.descricao}</h3>
                      <small>vence em {dataBR(l.vencimento)}</small>
                    </div>
                    <span className="mono" style={{ color: l.tipo === 'despesa' ? 'var(--c-mb)' : 'var(--c-mbom)' }}>
                      {moeda(Number(l.valor))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        </Grade>
      </>
    )
  );
}
