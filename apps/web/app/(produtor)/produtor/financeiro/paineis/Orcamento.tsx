import { moeda } from '@/lib/formato';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { criarOrcamento, excluirOrcamento } from '../acoes';
import type { ContextoFinanceiro } from '../dados';

export function PainelOrcamento({ ctx }: { ctx: ContextoFinanceiro }) {
  const { lancamentos, orcamentos, nomeCategoria, anoAtual, categoriasDespesa } = ctx;

  return (
    (
      <>
        <p className="nota" style={{ margin: '0 0 14px' }}>
          Comparado ao gasto pago em {anoAtual} (o período é o ano civil).
        </p>
        {orcamentos.length === 0 ? (
          <Vazio titulo="Nenhum orçamento definido" />
        ) : (
          <div className="lista" style={{ marginBottom: 14 }}>
            {orcamentos.map((o) => {
              const realizado = lancamentos
                .filter((l) => l.categoria_id === o.categoria_id && l.status === 'pago' && l.data.slice(0, 4) === anoAtual)
                .reduce((s, l) => s + Number(l.valor), 0);
              const pct = o.valor_planejado > 0 ? Math.min(100, (100 * realizado) / o.valor_planejado) : 0;
              const estourou = realizado > o.valor_planejado;
              return (
                <div className="item" key={o.id} style={{ alignItems: 'flex-start' }}>
                  <div className="cresce">
                    <h3>{nomeCategoria(o.categoria_id)}</h3>
                    <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, margin: '6px 0' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: estourou ? 'var(--c-mb)' : 'var(--c-mbom)', borderRadius: 99 }} />
                    </div>
                    <small className="mono">{moeda(realizado)} de {moeda(Number(o.valor_planejado))}</small>
                  </div>
                  {estourou ? <Tag tom="ruim">estourou</Tag> : <Tag tom="ok">no plano</Tag>}
                  <form action={excluirOrcamento}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="btn sec mini" type="submit">remover</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        <Cartao olho="Novo" titulo="Planejar categoria">
          <form action={criarOrcamento} className="grade g2">
            <div className="campo">
              <label htmlFor="o_cat">Categoria</label>
              <select id="o_cat" name="categoria_id" required defaultValue="">
                <option value="" disabled>selecione…</option>
                {categoriasDespesa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="campo"><label htmlFor="o_valor">Valor planejado (ano) <span className="un">R$</span></label><input id="o_valor" name="valor_planejado" className="mono" inputMode="decimal" required /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar orçamento</button></div>
          </form>
        </Cartao>
      </>
    )
  );
}
