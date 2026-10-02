import { dataBR, moeda } from '@/lib/formato';
import { ROTULO_STATUS_LANCAMENTO, type StatusLancamento } from '@/lib/financeiro';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { criarLancamentoEscritorio, mudarStatusLancamentoEscritorio, excluirLancamentoEscritorio } from '../acoes';
import type { ContextoFinanceiroEscritorio } from '../dados';

export function PainelLancamentos({ ctx }: { ctx: ContextoFinanceiroEscritorio }) {
  const { contas, lancamentos, produtores, nomeCategoria, nomeConta, nomeProdutor, urlComprovante, hojeISO, comStatus, categoriasReceita, categoriasDespesa } = ctx;

  return (
    (
      <>
        <Cartao olho="Novo" titulo="Lançar receita ou despesa">
          <form action={criarLancamentoEscritorio} className="grade g2" encType="multipart/form-data">
            <div className="campo">
              <label htmlFor="l_tipo">Tipo</label>
              <select id="l_tipo" name="tipo" required defaultValue="despesa">
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="l_desc">Descrição</label><input id="l_desc" name="descricao" required autoComplete="off" /></div>
            <div className="campo"><label htmlFor="l_valor">Valor <span className="un">R$</span></label><input id="l_valor" name="valor" className="mono" inputMode="decimal" required /></div>
            <div className="campo"><label htmlFor="l_data">Data</label><input id="l_data" name="data" type="date" defaultValue={hojeISO} required /></div>
            <div className="campo"><label htmlFor="l_venc">Vencimento (opcional)</label><input id="l_venc" name="vencimento" type="date" /></div>
            <div className="campo">
              <label htmlFor="l_status">Situação</label>
              <select id="l_status" name="status" defaultValue="pendente">
                <option value="pendente">A vencer</option>
                <option value="pago">Já pago</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="l_cat">Categoria</label>
              <select id="l_cat" name="categoria_id" defaultValue="">
                <option value="">sem categoria</option>
                <optgroup label="Receita">
                  {categoriasReceita.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
                <optgroup label="Despesa">
                  {categoriasDespesa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="l_conta">Conta</label>
              <select id="l_conta" name="conta_id" defaultValue="">
                <option value="">sem conta</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {produtores.length > 0 && (
              <div className="campo">
                <label htmlFor="l_prod">Cliente (opcional)</label>
                <select id="l_prod" name="produtor_id" defaultValue="">
                  <option value="">—</option>
                  {produtores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="l_obs">Observação (opcional)</label>
              <input id="l_obs" name="observacao" autoComplete="off" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="l_comp">Comprovante — nota fiscal, recibo (opcional)</label>
              <input id="l_comp" name="comprovante" type="file" accept="image/*,.pdf" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Lançar</button></div>
          </form>
        </Cartao>

        <Cartao olho={`${lancamentos.length} lançamento(s)`} titulo="Histórico" style={{ marginTop: 14 }}>
          {lancamentos.length === 0 ? (
            <Vazio titulo="Nenhum lançamento ainda" />
          ) : (
            <div className="rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th>
                    <th className="num">Valor</th><th>Situação</th><th />
                  </tr>
                </thead>
                <tbody>
                  {comStatus.map((l) => {
                    const s = ROTULO_STATUS_LANCAMENTO[l.statusEf as StatusLancamento] ?? ROTULO_STATUS_LANCAMENTO.pendente;
                    const url = l.comprovante_path ? urlComprovante.get(l.comprovante_path) : undefined;
                    const cliente = nomeProdutor(l.produtor_id);
                    return (
                      <tr key={l.id}>
                        <td className="mono">{dataBR(l.data)}</td>
                        <td>
                          {l.descricao}
                          {cliente ? <> · {cliente}</> : null}
                          {url ? <> · <a href={url} target="_blank" rel="noreferrer">comprovante</a></> : null}
                        </td>
                        <td>{nomeCategoria(l.categoria_id)}</td>
                        <td>{nomeConta(l.conta_id)}</td>
                        <td className="num mono" style={{ color: l.tipo === 'despesa' ? 'var(--c-mb)' : 'var(--c-mbom)' }}>
                          {l.tipo === 'despesa' ? '− ' : '+ '}{moeda(Number(l.valor))}
                        </td>
                        <td><Tag tom={s.tom}>{s.txt}</Tag></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {l.status !== 'pago' && (
                            <form action={mudarStatusLancamentoEscritorio} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={l.id} />
                              <input type="hidden" name="status" value="pago" />
                              <button className="btn sec mini" type="submit">pago</button>
                            </form>
                          )}{' '}
                          <form action={excluirLancamentoEscritorio} style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="btn sec mini" type="submit">excluir</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </>
    )
  );
}
