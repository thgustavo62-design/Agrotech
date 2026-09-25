import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { f, dataBR, moeda } from '@/lib/formato';
import { ROTULO_STATUS_LANCAMENTO, statusEfetivo, NOME_TIPO_CONTA, type StatusLancamento } from '@/lib/financeiro';
import { temFeature } from '@/lib/planos';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { PrecisaUpgrade } from '@/components/precisa-upgrade';
import {
  criarLancamento, mudarStatusLancamento, excluirLancamento,
  criarConta, criarCategoria, criarCentroCusto, criarOrcamento, excluirOrcamento,
} from './acoes';

export const dynamic = 'force-dynamic';

type Categoria = { id: string; nome: string; tipo: 'receita' | 'despesa'; padrao: boolean };
type CentroCusto = { id: string; nome: string; propriedade_id: string | null; talhao_id: string | null };
type Conta = { id: string; nome: string; tipo: string; saldo_inicial: number };
type Lancamento = {
  id: string; conta_id: string | null; categoria_id: string | null; propriedade_id: string | null; talhao_id: string | null;
  tipo: 'receita' | 'despesa'; descricao: string; valor: number; data: string; vencimento: string | null;
  status: string; comprovante_path: string | null; observacao: string | null;
};
type Orcamento = { id: string; categoria_id: string | null; valor_planejado: number };

export default async function FinanceiroProdutor() {
  const produtor = await produtorAtual();
  if (!produtor) notFound();

  const sb = await criarClienteServidor();

  if (!(await temFeature(sb, 'financeiro'))) {
    return (
      <PrecisaUpgrade
        titulo="Financeiro"
        descricao="Lançamentos, contas, categorias e orçamento da sua produção — só você vê."
      />
    );
  }

  await sb.schema('agro').rpc('semear_categorias_financeiras', { p_produtor: produtor.id });

  const [
    { data: categoriasRaw }, { data: centrosRaw }, { data: contasRaw }, { data: lancamentosRaw },
    { data: orcamentosRaw }, { data: propriedadesRaw }, { data: talhoesRaw },
  ] = await Promise.all([
    sb.schema('agro').from('financeiro_categorias').select('id, nome, tipo, padrao').order('nome'),
    sb.schema('agro').from('financeiro_centros_custo').select('id, nome, propriedade_id, talhao_id').order('nome'),
    sb.schema('agro').from('financeiro_contas').select('id, nome, tipo, saldo_inicial').order('nome'),
    sb.schema('agro').from('financeiro_lancamentos')
      .select('id, conta_id, categoria_id, propriedade_id, talhao_id, tipo, descricao, valor, data, vencimento, status, comprovante_path, observacao')
      .order('data', { ascending: false })
      .limit(300),
    sb.schema('agro').from('financeiro_orcamentos').select('id, categoria_id, valor_planejado').order('criado_em'),
    sb.schema('agro').from('propriedades').select('id, nome').order('nome'),
    sb.schema('agro').from('talhoes').select('id, nome, propriedade_id').order('nome'),
  ]);

  const categorias = (categoriasRaw ?? []) as Categoria[];
  const centros = (centrosRaw ?? []) as CentroCusto[];
  const contas = (contasRaw ?? []) as Conta[];
  const lancamentos = (lancamentosRaw ?? []) as Lancamento[];
  const orcamentos = (orcamentosRaw ?? []) as Orcamento[];
  const propriedades = (propriedadesRaw ?? []) as Array<{ id: string; nome: string }>;
  const talhoes = (talhoesRaw ?? []) as Array<{ id: string; nome: string; propriedade_id: string }>;

  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? '—';
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—';

  const comprovantes = lancamentos.filter((l) => l.comprovante_path).map((l) => l.comprovante_path!) as string[];
  const { data: assinadas } = comprovantes.length
    ? await sb.storage.from('financeiro').createSignedUrls(comprovantes, 3600)
    : { data: [] as Array<{ path: string | null; signedUrl: string }> };
  const urlComprovante = new Map<string, string | null>((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));

  const hojeISO = new Date().toISOString().slice(0, 10);
  const mesAtual = hojeISO.slice(0, 7);
  const anoAtual = hojeISO.slice(0, 4);

  const comStatus = lancamentos.map((l) => ({ ...l, statusEf: statusEfetivo(l.status, l.vencimento, hojeISO) }));

  const totalContas = contas.reduce((s, c) => s + Number(c.saldo_inicial), 0);
  const totalReceitasPagas = lancamentos.filter((l) => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesasPagas = lancamentos.filter((l) => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const saldoGeral = totalContas + totalReceitasPagas - totalDespesasPagas;

  const saldoConta = (contaId: string, saldoInicial: number) => {
    const rec = lancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago' && l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
    const desp = lancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago' && l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
    return saldoInicial + rec - desp;
  };

  const doMes = lancamentos.filter((l) => l.data.slice(0, 7) === mesAtual);
  const receitasMes = doMes.filter((l) => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const despesasMes = doMes.filter((l) => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const despesaPorCategoriaMes = new Map<string, number>();
  for (const l of doMes) {
    if (l.tipo !== 'despesa' || l.status !== 'pago') continue;
    const chave = l.categoria_id ?? '__sem';
    despesaPorCategoriaMes.set(chave, (despesaPorCategoriaMes.get(chave) ?? 0) + Number(l.valor));
  }
  const despesasCategoriaOrdenadas = [...despesaPorCategoriaMes.entries()].sort((a, b) => b[1] - a[1]);

  const atrasados = comStatus.filter((l) => l.statusEf === 'atrasado').sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''));
  const proximosVencimentos = comStatus
    .filter((l) => l.status === 'pendente' && l.vencimento && l.vencimento >= hojeISO)
    .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!))
    .slice(0, 5);
  const pendenciasTotal = comStatus.filter((l) => l.statusEf === 'pendente' || l.statusEf === 'atrasado').length;

  const categoriasReceita = categorias.filter((c) => c.tipo === 'receita');
  const categoriasDespesa = categorias.filter((c) => c.tipo === 'despesa');

  const paineis: Painel[] = [
    {
      id: 'resumo',
      rotulo: 'Resumo',
      conteudo: (
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
                    <form action={mudarStatusLancamento}>
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
      ),
    },
    {
      id: 'lancamentos',
      rotulo: 'Lançamentos',
      contagem: lancamentos.length,
      conteudo: (
        <>
          <Cartao olho="Novo" titulo="Lançar receita ou despesa">
            <form action={criarLancamento} className="grade g2" encType="multipart/form-data">
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
              {propriedades.length > 0 && (
                <div className="campo">
                  <label htmlFor="l_prop">Propriedade (opcional)</label>
                  <select id="l_prop" name="propriedade_id" defaultValue="">
                    <option value="">—</option>
                    {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {talhoes.length > 0 && (
                <div className="campo">
                  <label htmlFor="l_talhao">Talhão (opcional)</label>
                  <select id="l_talhao" name="talhao_id" defaultValue="">
                    <option value="">—</option>
                    {talhoes.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
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
                      return (
                        <tr key={l.id}>
                          <td className="mono">{dataBR(l.data)}</td>
                          <td>
                            {l.descricao}
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
                              <form action={mudarStatusLancamento} style={{ display: 'inline' }}>
                                <input type="hidden" name="id" value={l.id} />
                                <input type="hidden" name="status" value="pago" />
                                <button className="btn sec mini" type="submit">pago</button>
                              </form>
                            )}{' '}
                            <form action={excluirLancamento} style={{ display: 'inline' }}>
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
      ),
    },
    {
      id: 'contas-categorias',
      rotulo: 'Contas & categorias',
      conteudo: (
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
      ),
    },
    {
      id: 'orcamento',
      rotulo: 'Orçamento',
      contagem: orcamentos.length,
      conteudo: (
        <>
          <p className="nota" style={{ margin: '0 0 14px' }}>
            Comparado ao gasto pago em {anoAtual}. Ainda não há seleção de safra aqui —
            isso chega junto da Fase 7 (Produção); por ora o período é o ano civil.
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
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/produtor">← Início</Link>
      </div>

      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo="Financeiro"
        descricao="Só você vê estas informações — nem o seu técnico tem acesso a esta aba."
        tags={['Privado', 'Fluxo de caixa', 'Controle']}
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
