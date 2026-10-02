import { moeda } from '@/lib/formato';
import { NOME_TIPO_CONTA } from '@/lib/financeiro';
import { Cartao, Grade, Tag } from '@/components/ui';
import { criarContaEscritorio, criarCategoriaEscritorio } from '../acoes';
import type { ContextoFinanceiroEscritorio } from '../dados';

export function PainelContasCategorias({ ctx }: { ctx: ContextoFinanceiroEscritorio }) {
  const { categorias, contas, saldoConta, categoriasReceita, categoriasDespesa } = ctx;

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
            <form action={criarContaEscritorio} className="grade g2" style={{ marginTop: 10 }}>
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
            <form action={criarCategoriaEscritorio} className="grade g2" style={{ marginTop: 10 }}>
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
      </>
    )
  );
}
