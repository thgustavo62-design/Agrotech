import { notFound } from 'next/navigation';
import Link from 'next/link';
import { calcular, nomeCorretivo, type Corretivo } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { nomeCultura, CULTURAS, paraAnalise } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { rotuloAtividade, linkAtividade, type AtividadeBruta } from '@/lib/atividade';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { criarCompartilhamento, alternarCompartilhamento, convidarProdutor, excluirProdutor } from './acoes';
import { salvarPropriedade, salvarTalhao } from '../acoes';

export const dynamic = 'force-dynamic';

type AnaliseRow = {
  id: string; data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null; s: number | null;
};
type TalhaoRow = {
  id: string; nome: string; cultura: string | null; area_ha: number | null; prod_esperada: number | null;
  propriedade: { id: string; nome: string | null } | null;
  analises: AnaliseRow[];
};
type Situacao = 'precisa_correcao' | 'atencao' | 'em_ordem' | 'sem_analise';
const SITUACAO: Record<Situacao, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  atencao: { txt: 'fósforo baixo', tom: 'alerta' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export default async function PaginaProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const [
    { data: prod, error }, { data: talhoesRaw }, { data: propriedadesRaw }, { data: comps },
    { data: convites }, tabelas, { data: recsRaw }, { data: docsRaw },
  ] = await Promise.all([
    sb.schema('agro').from('produtores').select('id, nome, email, fone, cpf_cnpj, user_id').eq('id', id).single(),
    sb.schema('agro').from('talhoes')
      .select(`id, nome, cultura, area_ha, prod_esperada,
               propriedade:propriedade_id(id, nome),
               analises:analises(id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s)`)
      .order('nome'),
    sb.schema('agro').from('propriedades').select('id, nome, municipio, area_total').order('nome'),
    sb.schema('agro').from('compartilhamentos')
      .select('id, cultura, rotulo, token, ativo, acessos')
      .eq('produtor_id', id).order('criado_em', { ascending: false }),
    sb.schema('agro').from('convites')
      .select('email, expira_em, usado_em').eq('produtor_id', id).order('criado_em', { ascending: false }).limit(3),
    tabelasDaOrg(sb),
    sb.schema('agro').from('recomendacoes')
      .select('id, analise_id, emitida_em, motor_versao, resultado, analise:analise_id(talhao:talhao_id(nome, cultura))')
      .eq('produtor_id', id).is('arquivada_em', null)
      .order('emitida_em', { ascending: false }),
    sb.schema('agro').from('documentos')
      .select('id, nome_arquivo, laboratorio, status, confianca_media, criado_em')
      .eq('produtor_id', id).order('criado_em', { ascending: false }),
  ]);

  if (error || !prod) notFound();

  const talhoes = (talhoesRaw ?? []) as unknown as TalhaoRow[];
  const propriedades = (propriedadesRaw ?? []) as Array<{ id: string; nome: string; municipio: string | null; area_total: number | null }>;
  const talhaoIds = talhoes.map((t) => t.id);

  const { data: visitasRaw } = talhaoIds.length
    ? await sb.schema('agro').from('visitas')
        .select('id, talhao_id, data, fenologia, condicao, proxima_visita, ocorrencias:visita_ocorrencias(acima_nivel)')
        .in('talhao_id', talhaoIds).order('data', { ascending: false })
    : { data: [] as never[] };
  const visitas = (visitasRaw ?? []) as unknown as Array<{
    id: string; talhao_id: string; data: string; fenologia: string | null; condicao: string | null;
    proxima_visita: string | null; ocorrencias: Array<{ acima_nivel: boolean }>;
  }>;

  // ---- resumo por talhão (V/m/situação), calculado uma vez, reaproveitado no resto da página ----
  const resumos = talhoes.map((t) => {
    const ordenadas = [...(t.analises ?? [])].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta));
    const ultima = ordenadas[0];
    const anterior = ordenadas[1];
    const cult = t.cultura ? tabelas.culturas[t.cultura] : undefined;
    const V2 = cult?.V2 ?? 60;
    const mMax = cult?.m_max ?? 20;
    if (!ultima) return { talhao: t, ultima: undefined, anterior: undefined, r: undefined, rAnterior: undefined, V2, mMax, situacao: 'sem_analise' as Situacao };
    const r = calcular(paraAnalise(ultima), tabelas);
    const rAnterior = anterior ? calcular(paraAnalise(anterior), tabelas) : undefined;
    const situacao: Situacao = (r.V < V2 - 10 || r.m > mMax) ? 'precisa_correcao' : r.classeP <= 1 ? 'atencao' : 'em_ordem';
    return { talhao: t, ultima, anterior, r, rAnterior, V2, mMax, situacao };
  });

  const porCultura = new Map<string, typeof resumos>();
  for (const x of resumos) {
    const chave = x.talhao.cultura ?? '__sem';
    if (!porCultura.has(chave)) porCultura.set(chave, []);
    porCultura.get(chave)!.push(x);
  }
  const culturasOrdenadas = [...porCultura.keys()].sort((a, b) => nomeCultura(a).localeCompare(nomeCultura(b)));

  const areaTotal = talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const totalAnalises = talhoes.reduce((s, t) => s + (t.analises?.length ?? 0), 0);
  const nCritico = resumos.filter((x) => x.situacao === 'precisa_correcao').length;
  const nAtencao = resumos.filter((x) => x.situacao === 'atencao').length;
  const situacaoGeral: { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' } =
    nCritico > 0 ? { txt: `${nCritico} talhão(ões) precisando de correção`, tom: 'ruim' }
    : nAtencao > 0 ? { txt: `${nAtencao} talhão(ões) com fósforo baixo`, tom: 'alerta' }
    : resumos.some((x) => x.situacao === 'em_ordem') ? { txt: 'solo em ordem', tom: 'ok' }
    : { txt: 'sem análise lançada', tom: 'cinza' };

  const hojeISO = new Date().toISOString().slice(0, 10);
  const ultimaVisita = [...visitas].sort((a, b) => b.data.localeCompare(a.data))[0];
  const proximaVisita = visitas.map((v) => v.proxima_visita).filter((d): d is string => d != null && d >= hojeISO).sort()[0];

  const recomendacoes = (recsRaw ?? []) as unknown as Array<{
    id: string; analise_id: string; emitida_em: string; motor_versao: string; resultado: Record<string, unknown>;
    analise: { talhao: { nome: string; cultura: string | null } | null } | null;
  }>;
  const documentos = (docsRaw ?? []) as Array<{
    id: string; nome_arquivo: string | null; laboratorio: string | null; status: string; confianca_media: number | null; criado_em: string;
  }>;

  // ---- linha do tempo: audit_log de tudo que pertence a este produtor ----
  const idsRelevantes = [
    id,
    ...talhaoIds,
    ...talhoes.flatMap((t) => (t.analises ?? []).map((a) => a.id)),
    ...recomendacoes.map((r) => r.id),
    ...documentos.map((d) => d.id),
    ...visitas.map((v) => v.id),
  ];
  const { data: atividadeRaw } = idsRelevantes.length
    ? await sb.schema('agro').from('audit_log')
        .select('acao, entidade, entidade_id, dados, criado_em')
        .in('entidade_id', idsRelevantes).order('criado_em', { ascending: false }).limit(30)
    : { data: [] as AtividadeBruta[] };
  const atividade = (atividadeRaw ?? []) as AtividadeBruta[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const seta = (atual: number, anterior: number | undefined) => {
    if (anterior == null) return '';
    if (atual > anterior + 0.5) return ' ▲';
    if (atual < anterior - 0.5) return ' ▼';
    return ' –';
  };

  const paineis: Painel[] = [
    {
      id: 'resumo',
      rotulo: 'Resumo',
      conteudo: (
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
      ),
    },
    {
      id: 'propriedades',
      rotulo: 'Propriedades',
      contagem: propriedades.length,
      conteudo: (
        <>
          {propriedades.length === 0 ? (
            <Vazio titulo="Nenhuma propriedade cadastrada" />
          ) : (
            <div className="lista" style={{ marginBottom: 14 }}>
              {propriedades.map((pr) => {
                const nTalhoes = talhoes.filter((t) => t.propriedade?.id === pr.id).length;
                return (
                  <div className="item" key={pr.id}>
                    <div className="cresce">
                      <h3>{pr.nome}</h3>
                      <small>
                        {pr.municipio ?? 'município não informado'} ·{' '}
                        {pr.area_total ? `${f(Number(pr.area_total), 1)} ha declarados` : 'área não informada'} · {nTalhoes} talhão(ões)
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Cartao olho="Cadastro" titulo="Nova propriedade">
            <form action={salvarPropriedade} className="grade g2">
              <input type="hidden" name="produtor_id" value={id} />
              <div className="campo"><label htmlFor="pr_nome">Nome</label><input id="pr_nome" name="nome" required autoComplete="off" /></div>
              <div className="campo"><label htmlFor="pr_mun">Município</label><input id="pr_mun" name="municipio" autoComplete="off" /></div>
              <div className="campo"><label htmlFor="pr_uf">UF</label><input id="pr_uf" name="uf" defaultValue="ES" maxLength={2} /></div>
              <div className="campo"><label htmlFor="pr_area">Área total <span className="un">ha</span></label><input id="pr_area" name="area_total" className="mono" inputMode="decimal" /></div>
              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar propriedade</button></div>
            </form>
          </Cartao>
        </>
      ),
    },
    {
      id: 'talhoes',
      rotulo: 'Talhões',
      contagem: talhoes.length,
      conteudo: (
        <>
          {culturasOrdenadas.length === 0 ? (
            <Vazio titulo="Nenhum talhão para este produtor">Cadastre uma propriedade e um talhão abaixo.</Vazio>
          ) : (
            culturasOrdenadas.map((chave) => {
              const grupo = porCultura.get(chave)!;
              const areaCultura = grupo.reduce((s, x) => s + Number(x.talhao.area_ha ?? 0), 0);
              return (
                <Cartao
                  key={chave}
                  olho={`Cultura · ${f(areaCultura, 1)} ha em ${grupo.length} talhão(ões)`}
                  titulo={nomeCultura(chave === '__sem' ? null : chave)}
                  style={{ marginTop: 14 }}
                >
                  <div className="rolagem">
                    <table>
                      <thead>
                        <tr>
                          <th>Talhão</th><th className="num">Área</th><th className="num">Última coleta</th>
                          <th className="num">V%</th><th className="num">m%</th><th />
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.map((x) => (
                          <tr key={x.talhao.id}>
                            <td>
                              <Link href={`/app/talhoes/${x.talhao.id}`}>{x.talhao.nome}</Link><br />
                              <small className="nota">{x.talhao.propriedade?.nome ?? '—'}</small>
                            </td>
                            <td className="num">{f(Number(x.talhao.area_ha ?? 0), 1)} ha</td>
                            <td className="num">{x.ultima ? dataBR(x.ultima.data_coleta) : '—'}</td>
                            <td className="num" style={{ color: x.r ? (x.r.V >= x.V2 ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                              {x.r ? `${f(x.r.V, 0)}%` : '—'}
                            </td>
                            <td className="num" style={{ color: x.r ? (x.r.m <= x.mMax ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                              {x.r ? `${f(x.r.m, 0)}%` : '—'}
                            </td>
                            <td className="num" style={{ whiteSpace: 'nowrap' }}>
                              <Link className="btn sec mini" href={`/app/talhoes/${x.talhao.id}/editar`}>editar</Link>{' '}
                              {x.ultima
                                ? <Link className="btn sec mini" href={`/app/analises/${x.ultima.id}`}>abrir</Link>
                                : <Link className="btn sec mini" href="/app/analises/nova">análise</Link>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Cartao>
              );
            })
          )}

          <Cartao olho="Cadastro" titulo="Novo talhão" style={{ marginTop: 14 }}>
            {propriedades.length === 0 ? (
              <p className="nota">Cadastre uma propriedade primeiro (aba Propriedades).</p>
            ) : (
              <form action={salvarTalhao} className="grade g2">
                <input type="hidden" name="produtor_id" value={id} />
                <div className="campo">
                  <label htmlFor="t_prop">Propriedade</label>
                  <select id="t_prop" name="propriedade_id" required defaultValue="">
                    <option value="" disabled>selecione…</option>
                    {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="campo"><label htmlFor="t_nome">Nome do talhão</label><input id="t_nome" name="nome" required autoComplete="off" /></div>
                <div className="campo">
                  <label htmlFor="t_cult">Cultura</label>
                  <select id="t_cult" name="cultura" required defaultValue="">
                    <option value="" disabled>selecione…</option>
                    {CULTURAS.map((c) => <option key={c} value={c}>{nomeCultura(c)}</option>)}
                  </select>
                </div>
                <div className="campo"><label htmlFor="t_var">Variedade</label><input id="t_var" name="variedade" autoComplete="off" /></div>
                <div className="campo"><label htmlFor="t_area">Área <span className="un">ha</span></label><input id="t_area" name="area_ha" className="mono" inputMode="decimal" /></div>
                <div className="campo"><label htmlFor="t_prod">Produtividade esperada</label><input id="t_prod" name="prod_esperada" className="mono" inputMode="decimal" /></div>
                <div className="campo"><label htmlFor="t_esp">Espaçamento</label><input id="t_esp" name="espacamento" placeholder="3,0 × 1,2 m" autoComplete="off" /></div>
                <div className="campo"><label htmlFor="t_ano">Ano de implantação</label><input id="t_ano" name="ano_implantacao" className="mono" inputMode="numeric" /></div>
                <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar talhão</button></div>
              </form>
            )}
          </Cartao>
        </>
      ),
    },
    {
      id: 'analises',
      rotulo: 'Análises',
      contagem: totalAnalises,
      conteudo: totalAnalises === 0 ? (
        <Vazio titulo="Nenhuma análise lançada para este produtor">
          <Link href="/app/analises/nova">Lançar a primeira.</Link>
        </Vazio>
      ) : (
        <div className="lista">
          {talhoes.flatMap((t) => (t.analises ?? []).map((a) => ({ a, t })))
            .sort((x, y) => y.a.data_coleta.localeCompare(x.a.data_coleta))
            .map(({ a, t }) => {
              const r = calcular(paraAnalise(a), tabelas);
              const cult = t.cultura ? tabelas.culturas[t.cultura] : undefined;
              const okV = r.V >= (cult?.V2 ?? 60);
              return (
                <div className="item" key={a.id}>
                  <div className="cresce">
                    <h3>{t.nome} — {dataBR(a.data_coleta)}</h3>
                    <small className="mono">{nomeCultura(t.cultura)} · pH {f(Number(a.ph ?? 0), 1)} · V {f(r.V, 0)}% · m {f(r.m, 0)}%</small>
                  </div>
                  <Tag tom={okV ? 'ok' : 'ruim'}>V {f(r.V, 0)}%</Tag>
                  <Link className="btn mini" href={`/app/analises/${a.id}`}>interpretar</Link>
                </div>
              );
            })}
        </div>
      ),
    },
    {
      id: 'recomendacoes',
      rotulo: 'Recomendações',
      contagem: recomendacoes.length,
      conteudo: recomendacoes.length === 0 ? (
        <Vazio titulo="Nenhuma recomendação emitida para este produtor" />
      ) : (
        <div className="lista">
          {recomendacoes.map((r) => {
            const res = r.resultado;
            const cal = res.calagem as { corrigido?: number } | undefined;
            const corretivo = res.corretivo as { corretivo?: Corretivo } | undefined;
            const ad = res.adubacao as { N?: number; P2O5?: number; K2O?: number } | undefined;
            return (
              <div className="item" key={r.id}>
                <div className="cresce">
                  <h3>{r.analise?.talhao?.nome ?? 'Talhão removido'}</h3>
                  <small className="mono">
                    {nomeCultura(r.analise?.talhao?.cultura ?? null)} · emitida em {dataBR(r.emitida_em.slice(0, 10))}
                    {cal?.corrigido != null ? ` · calcário ${f(cal.corrigido, 1)} t/ha` : ''}
                    {corretivo?.corretivo ? ` (${nomeCorretivo(corretivo.corretivo).toLowerCase()})` : ''}
                    {ad ? ` · N ${ad.N} P₂O₅ ${ad.P2O5} K₂O ${ad.K2O}` : ''}
                  </small>
                </div>
                <Tag tom="cinza">motor {r.motor_versao}</Tag>
                <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'visitas',
      rotulo: 'Visitas',
      contagem: visitas.length,
      conteudo: visitas.length === 0 ? (
        <Vazio titulo="Nenhuma visita registrada para este produtor">
          O formulário de registrar visita ainda não existe no app (ver <code>PRODUCT_AUDIT.md</code>).
        </Vazio>
      ) : (
        <div className="lista">
          {visitas.map((v) => {
            const talhao = talhoes.find((t) => t.id === v.talhao_id);
            const acima = v.ocorrencias.filter((o) => o.acima_nivel).length;
            return (
              <div className="item" key={v.id}>
                <div className="cresce">
                  <h3>{talhao?.nome ?? 'Talhão'} — {dataBR(v.data)}</h3>
                  <small>{v.fenologia ?? 'estádio não informado'} · condição {v.condicao ?? '—'}</small>
                </div>
                {acima > 0 ? <Tag tom="ruim">{acima} acima do nível</Tag> : <Tag>sob controle</Tag>}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'documentos',
      rotulo: 'Documentos',
      contagem: documentos.length,
      conteudo: documentos.length === 0 ? (
        <Vazio titulo="Nenhum laudo em PDF enviado para este produtor" />
      ) : (
        <div className="lista">
          {documentos.map((d) => {
            const s = ROTULO_STATUS_DOCUMENTO[d.status] ?? { txt: d.status, tom: 'cinza' as const };
            return (
              <div className="item" key={d.id}>
                <div className="cresce">
                  <h3>{d.nome_arquivo ?? 'laudo.pdf'}</h3>
                  <small>{d.laboratorio ?? 'laboratório não detectado'} · {dataBR(d.criado_em.slice(0, 10))}</small>
                </div>
                <Tag tom={s.tom}>{s.txt}</Tag>
                <Link className="btn sec mini" href={`/app/laudos/${d.id}`}>abrir</Link>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'acesso',
      rotulo: 'Acesso',
      conteudo: (
        <>
          <Cartao olho="Acesso do produtor" titulo="Links de resultados">
            <p className="nota" style={{ margin: '0 0 12px' }}>
              Gera um endereço que o produtor abre sem login e vê os resultados em tempo real — a lavoura
              toda ou uma cultura só.
            </p>
            {(comps ?? []).length > 0 && (
              <div className="lista" style={{ marginBottom: 14 }}>
                {(comps ?? []).map((c) => (
                  <div className="item" key={c.id as string}>
                    <div className="cresce" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <strong>{(c.rotulo as string) || nomeCultura((c.cultura as string) ?? null)}</strong>{' '}
                        {c.cultura ? <Tag tom="cinza">{nomeCultura(c.cultura as string)}</Tag> : <Tag>lavoura toda</Tag>}{' '}
                        <span className="nota">{c.acessos as number} acesso(s)</span>
                      </div>
                      <LinkCompartilhado url={`${appUrl}/r/${c.token}`} />
                    </div>
                    <form action={alternarCompartilhamento}>
                      <input type="hidden" name="id" value={c.id as string} />
                      <input type="hidden" name="produtor_id" value={id} />
                      <input type="hidden" name="ativo" value={String(c.ativo)} />
                      <button className="btn sec mini" type="submit">{c.ativo ? 'desativar' : 'reativar'}</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <form action={criarCompartilhamento} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input type="hidden" name="produtor_id" value={id} />
              <div className="campo" style={{ minWidth: 200 }}>
                <label htmlFor="cultura">Escopo</label>
                <select id="cultura" name="cultura" defaultValue="__todas">
                  <option value="__todas">Lavoura toda</option>
                  {culturasOrdenadas.filter((c) => c !== '__sem').map((c) => (
                    <option key={c} value={c}>{nomeCultura(c)}</option>
                  ))}
                </select>
              </div>
              <div className="campo" style={{ minWidth: 200 }}>
                <label htmlFor="rotulo">Rótulo (opcional)</label>
                <input id="rotulo" name="rotulo" placeholder="ex.: Safra 2026" autoComplete="off" />
              </div>
              <button className="btn verde" type="submit">Gerar link</button>
            </form>

            <hr style={{ border: 0, borderTop: '1px solid var(--linha)', margin: '18px 0 14px' }} />

            <h3 style={{ margin: '0 0 6px' }}>Portal com login próprio</h3>
            {prod.user_id ? (
              <p className="nota">
                <Tag tom="ok">acesso ativo</Tag> Este produtor já tem login e vê os talhões e laudos dele.
              </p>
            ) : (
              <>
                <p className="nota" style={{ margin: '0 0 10px' }}>
                  Diferente do link acima: o produtor cria uma senha e entra em <code>/produtor</code>.
                  Convite válido por 7 dias.
                </p>
                {(convites ?? []).some((cv) => !cv.usado_em) && (
                  <p className="nota">Convite pendente para {(convites ?? []).find((cv) => !cv.usado_em)?.email}.</p>
                )}
                <form action={convidarProdutor} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input type="hidden" name="produtor_id" value={id} />
                  <div className="campo" style={{ minWidth: 240 }}>
                    <label htmlFor="conv_email">E-mail do produtor</label>
                    <input id="conv_email" name="email" type="email" defaultValue={prod.email ?? ''} required autoComplete="off" />
                  </div>
                  <button className="btn verde" type="submit">Enviar convite</button>
                </form>
              </>
            )}
          </Cartao>

          <Cartao olho="Zona de risco" titulo="Excluir produtor (LGPD)" style={{ marginTop: 14 }}>
            <p className="nota" style={{ margin: '0 0 10px' }}>
              Atende ao pedido de eliminação do titular. Apaga <b>em definitivo</b> o produtor e tudo abaixo:
              propriedades, talhões, análises, recomendações e visitas. Não dá para desfazer.
              A ação fica registrada na trilha de auditoria.
            </p>
            <form action={excluirProdutor} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo" style={{ minWidth: 200 }}>
                <label htmlFor="confirmar">Digite <code>EXCLUIR</code> para confirmar</label>
                <input id="confirmar" name="confirmar" autoComplete="off" placeholder="EXCLUIR" />
              </div>
              <button className="btn" style={{ background: 'var(--c-mb)', borderColor: 'var(--c-mb)' }} type="submit">
                Excluir definitivamente
              </button>
            </form>
          </Cartao>
        </>
      ),
    },
    {
      id: 'linha-do-tempo',
      rotulo: 'Linha do tempo',
      conteudo: atividade.length === 0 ? (
        <Vazio titulo="Nada registrado ainda para este produtor" />
      ) : (
        <Cartao olho="Prontuário" titulo="Linha do tempo">
          <div className="lista">
            {atividade.map((a, i) => {
              const href = linkAtividade(a);
              return (
                <div className="item" key={i}>
                  <div className="cresce">
                    <h3 style={{ fontSize: 13.5 }}>{rotuloAtividade(a)}</h3>
                    <small>{dataBR(a.criado_em.slice(0, 10))} às {a.criado_em.slice(11, 16)}</small>
                  </div>
                  {href ? <Link className="btn sec mini" href={href}>abrir</Link> : null}
                </div>
              );
            })}
          </div>
        </Cartao>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/app/produtores">← Produtores</Link>
      </div>

      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Produtor"
        titulo={prod.nome}
        descricao={
          <>
            {[prod.email, prod.fone, prod.cpf_cnpj].filter(Boolean).join(' · ') || 'sem contato cadastrado'}
            {' · '}{f(areaTotal, 1)} ha assistidos
            {ultimaVisita ? ` · última visita ${dataBR(ultimaVisita.data)}` : ''}
            {proximaVisita ? ` · próxima em ${dataBR(proximaVisita)}` : ''}
          </>
        }
        tags={culturasOrdenadas.filter((c) => c !== '__sem').map((c) => nomeCultura(c))}
        acoes={
          <>
            <Tag tom={situacaoGeral.tom}>{situacaoGeral.txt}</Tag>
            <Link className="btn sec" href={`/app/produtores/${id}/editar`}>Editar</Link>
            <Link className="btn sec" prefetch={false} href={`/app/produtores/${id}/exportar`}>Exportar dados</Link>
          </>
        }
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
