import { moeda } from '@/lib/formato';
import { NOME_TIPO_CONTA } from '@/lib/financeiro';
import { Cartao, Grade, Tag } from '@/components/ui';
import { criarConta, criarCategoria, criarCentroCusto } from '../acoes';
import type { ContextoFinanceiro } from '../dados';

export function PainelContasCategorias({ ctx }: { ctx: ContextoFinanceiro }) {
  const { categorias, centros, contas, propriedades, talhoes, saldoConta, categoriasReceita, categoriasDespesa } = ctx;

  return (
    (
      <>
        <Cartao olho={`${contas.length} conta(s)`} titulo="Contas">
          {contas.length > 0 && (
            <div className="lista" style={{ marginBottom: 14 }}>
              {contas.map((c) => (
                <div className="item" key={c.id}>
                  <div className="cresce">
                    <h3>{c.nome}</h3>
                    <small>{NOME_TIPO_CONTA[c.tipo] ?? c.tipo}</small>
                  </div>
                  <span className="mono">{moeda(saldoConta(c.id, Number(c.saldo_inicial)))}</span>
                </div>
              ))}
            </div>
          )}
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Nova conta</summary>
            <form action={criarConta} className="grade g2" style={{ marginTop: 10 }}>
              <div className="campo"><label htmlFor="c_nome">Nome</label><input id="c_nome" name="nome" required autoComplete="off" /></div>
              <div className="campo">
                <label htmlFor="c_tipo">Tipo</label>
                <select id="c_tipo" name="tipo" defaultValue="corrente">
                  <option value="corrente">Conta corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="caixa">Caixa</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="campo"><label htmlFor="c_saldo">Saldo inicial <span className="un">R$</span></label><input id="c_saldo" name="saldo_inicial" className="mono" inputMode="decimal" defaultValue="0" /></div>
              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar conta</button></div>
            </form>
          </details>
        </Cartao>

        <Cartao olho={`${categorias.length} categoria(s)`} titulo="Categorias" style={{ marginTop: 14 }}>
          <Grade cols={2}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Receita</h3>
              <div className="lista">
                {categoriasReceita.map((c) => (
                  <div className="item" key={c.id}><div className="cresce"><h3>{c.nome}</h3></div>{c.padrao ? <Tag tom="cinza">padrão</Tag> : null}</div>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Despesa</h3>
              <div className="lista">
                {categoriasDespesa.map((c) => (
                  <div className="item" key={c.id}><div className="cresce"><h3>{c.nome}</h3></div>{c.padrao ? <Tag tom="cinza">padrão</Tag> : null}</div>
                ))}
              </div>
            </div>
          </Grade>
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Nova categoria</summary>
            <form action={criarCategoria} className="grade g2" style={{ marginTop: 10 }}>
              <div className="campo"><label htmlFor="cat_nome">Nome</label><input id="cat_nome" name="nome" required autoComplete="off" /></div>
              <div className="campo">
                <label htmlFor="cat_tipo">Tipo</label>
                <select id="cat_tipo" name="tipo" required defaultValue="despesa">
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar categoria</button></div>
            </form>
          </details>
        </Cartao>

        <Cartao olho={`${centros.length} centro(s) de custo`} titulo="Centros de custo" style={{ marginTop: 14 }}>
          {centros.length > 0 && (
            <div className="lista" style={{ marginBottom: 14 }}>
              {centros.map((c) => (
                <div className="item" key={c.id}>
                  <div className="cresce">
                    <h3>{c.nome}</h3>
                    <small>{propriedades.find((p) => p.id === c.propriedade_id)?.nome ?? talhoes.find((t) => t.id === c.talhao_id)?.nome ?? 'sem vínculo'}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Novo centro de custo</summary>
            <form action={criarCentroCusto} className="grade g2" style={{ marginTop: 10 }}>
              <div className="campo"><label htmlFor="cc_nome">Nome</label><input id="cc_nome" name="nome" required autoComplete="off" /></div>
              {propriedades.length > 0 && (
                <div className="campo">
                  <label htmlFor="cc_prop">Propriedade (opcional)</label>
                  <select id="cc_prop" name="propriedade_id" defaultValue="">
                    <option value="">—</option>
                    {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar centro de custo</button></div>
            </form>
          </details>
        </Cartao>
      </>
    )
  );
}
