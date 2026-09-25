import { notFound } from 'next/navigation';
import Link from 'next/link';
import { calcular, gerarRecomendacao, nomeCorretivo, type Recomendacao } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { InterpretacaoView } from '@/components/interpretacao-view';
import { registrarVisita } from './acoes';

export const dynamic = 'force-dynamic';

type LinhaAnalise = {
  id: string; data_coleta: string; profundidade: string | null; laboratorio: string | null;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null;
  s: number | null; b: number | null; zn: number | null; cu: number | null; mn: number | null; fe: number | null;
  prnt: number | null; incorporacao: number | null; prod_esperada: number | null;
};
type LinhaRecomendacao = { id: string; analise_id: string; emitida_em: string; resultado: unknown };
type LinhaOcorrencia = { alvo: string; valor: string | null; acima_nivel: boolean };
type LinhaFoto = { id: string; storage_path: string; legenda: string | null };
type LinhaVisita = {
  id: string; data: string; fenologia: string | null; condicao: string | null;
  observacoes: string | null; recomendacao: string | null; proxima_visita: string | null;
  ocorrencias: LinhaOcorrencia[]; fotos: LinhaFoto[];
};

const SITUACAO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  atencao: { txt: 'fósforo baixo', tom: 'alerta' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export default async function TalhaoPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const [{ data: talhao, error }, { data: analisesRaw }, { data: visitasRaw }, tabelas] = await Promise.all([
    sb.schema('agro').from('talhoes').select(
      `id, nome, cultura, variedade, area_ha, prod_esperada, espacamento, ano_implantacao, obs,
       propriedade:propriedade_id ( id, nome, municipio, produtor:produtor_id ( id, nome ) )`,
    ).eq('id', id).single(),
    sb.schema('agro').from('analises')
      .select('id, data_coleta, profundidade, laboratorio, argila, ph, mo, p, k, na, ca, mg, al, h_al, s, b, zn, cu, mn, fe, prnt, incorporacao, prod_esperada')
      .eq('talhao_id', id).is('arquivado_em', null)
      .order('data_coleta', { ascending: false }),
    sb.schema('agro').from('visitas')
      .select('id, data, fenologia, condicao, observacoes, recomendacao, proxima_visita, ocorrencias:visita_ocorrencias(alvo, valor, acima_nivel), fotos:visita_fotos(id, storage_path, legenda)')
      .eq('talhao_id', id).order('data', { ascending: false }),
    tabelasDaOrg(sb),
  ]);

  if (error || !talhao) notFound();
  // deno-lint-ignore no-explicit-any
  const propriedade = (talhao as any).propriedade;
  const produtor = propriedade?.produtor;

  const analises = (analisesRaw ?? []) as unknown as LinhaAnalise[];
  const visitas = (visitasRaw ?? []) as unknown as LinhaVisita[];
  const ultima = analises[0];
  const cultura = talhao.cultura ? tabelas.culturas[talhao.cultura as string] : undefined;

  const calc = ultima ? calcular(paraAnalise(ultima), tabelas) : null;
  const V2 = cultura?.V2 ?? 60;
  const mMax = cultura?.m_max ?? 20;
  const situacaoChave = !ultima ? 'sem_analise'
    : (calc!.V < V2 - 10 || calc!.m > mMax) ? 'precisa_correcao'
    : calc!.classeP <= 1 ? 'atencao' : 'em_ordem';
  const situacao = SITUACAO[situacaoChave]!;

  const idsAnalises = analises.map((a) => a.id);
  const { data: recsRaw } = idsAnalises.length
    ? await sb.schema('agro').from('recomendacoes')
        .select('id, analise_id, emitida_em, resultado')
        .in('analise_id', idsAnalises).is('arquivada_em', null)
        .order('emitida_em', { ascending: false })
    : { data: [] as LinhaRecomendacao[] };
  const recomendacoes = (recsRaw ?? []) as unknown as LinhaRecomendacao[];

  const todasFotos = visitas.flatMap((v) => v.fotos ?? []);
  let urlsFotos = new Map<string, string | null>();
  if (todasFotos.length) {
    const { data: assinadas } = await sb.storage.from('visitas')
      .createSignedUrls(todasFotos.map((ft) => ft.storage_path), 3600);
    urlsFotos = new Map((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));
  }

  const proximaVisita = visitas.find((v) => v.proxima_visita)?.proxima_visita ?? null;

  // Produção: só os campos agronômicos (agro.producao_visivel_consultor nunca
  // seleciona preço/receita/observação — ver DATABASE_CHANGES.md §0022).
  const { data: producaoRaw } = await sb.schema('agro').rpc('producao_visivel_consultor');
  const producao = ((producaoRaw ?? []) as Array<{
    id: string; talhao_id: string | null; safra_id: string | null;
    producao_prevista: number | null; producao_realizada: number | null; unidade: string; criado_em: string;
  }>).filter((p) => p.talhao_id === id);

  // ---- linha do tempo (prontuário) — análises + recomendações + visitas, uma só ordem ----
  type Evento = { data: string; tipo: string; rotulo: string; href?: string };
  const timeline: Evento[] = [
    ...analises.map((a): Evento => ({ data: a.data_coleta, tipo: 'análise', rotulo: `Análise de solo recebida (${a.laboratorio ?? 'laboratório não informado'})`, href: `/app/analises/${a.id}` })),
    ...recomendacoes.map((r): Evento => ({ data: r.emitida_em.slice(0, 10), tipo: 'recomendação', rotulo: 'Recomendação emitida', href: `/app/analises/${r.analise_id}/laudo` })),
    ...visitas.map((v): Evento => ({ data: v.data, tipo: 'visita', rotulo: `Visita técnica${v.condicao ? ' — condição ' + v.condicao.toLowerCase() : ''}` })),
  ].sort((x, y) => y.data.localeCompare(x.data));

  const paineis: Painel[] = [
    {
      id: 'geral',
      rotulo: 'Visão geral',
      conteudo: (
        <>
          <Grade cols={4}>
            <Metrica rotulo="Área" valor={`${f(Number(talhao.area_ha ?? 0), 1)} ha`} />
            <Metrica
              rotulo="Saturação de bases"
              valor={calc ? `${f(calc.V, 0)}%` : '—'}
              detalhe={cultura ? `meta ${V2}%` : undefined}
              cor={calc ? (calc.V >= V2 ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined}
            />
            <Metrica
              rotulo="Saturação de alumínio"
              valor={calc ? `${f(calc.m, 0)}%` : '—'}
              detalhe={cultura ? `limite ${mMax}%` : undefined}
              cor={calc ? (calc.m <= mMax ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined}
            />
            <Metrica rotulo="Situação" valor={situacao.txt} cor={situacao.tom === 'ruim' ? 'var(--c-mb)' : situacao.tom === 'ok' ? 'var(--c-mbom)' : undefined} />
          </Grade>

          <Cartao olho="Cadastro" titulo="Dados do talhão" style={{ marginTop: 14 }}>
            <Grade cols={4}>
              <Metrica rotulo="Variedade" valor={talhao.variedade || '—'} />
              <Metrica rotulo="Espaçamento" valor={talhao.espacamento || '—'} />
              <Metrica rotulo="Implantação" valor={talhao.ano_implantacao || '—'} />
              <Metrica rotulo="Produtividade esperada" valor={talhao.prod_esperada ? `${f(Number(talhao.prod_esperada), 1)} ${cultura?.un ?? ''}` : '—'} />
            </Grade>
            {talhao.obs ? <p className="nota" style={{ marginTop: 12 }}>{talhao.obs}</p> : null}
          </Cartao>

          {proximaVisita && (
            <div className="aviso" style={{ marginTop: 14 }}>
              Próxima visita prevista para {dataBR(proximaVisita)}.
            </div>
          )}

          {ultima ? (
            <Cartao olho="Última coleta" titulo={`Análise de ${dataBR(ultima.data_coleta)}`} style={{ marginTop: 14 }}>
              <p className="nota" style={{ margin: '0 0 10px' }}>
                Veja os detalhes completos (réguas, diagnóstico, calagem e adubação) na aba Solo &amp; Nutrição.
              </p>
              <Link className="btn sec mini" href={`/app/analises/${ultima.id}`}>Abrir interpretação</Link>
            </Cartao>
          ) : (
            <Vazio titulo="Nenhuma análise lançada ainda" style={{ marginTop: 14 }}>
              <Link href="/app/analises/nova">Lançar a primeira.</Link>
            </Vazio>
          )}
        </>
      ),
    },
    {
      id: 'solo',
      rotulo: 'Solo & Nutrição',
      conteudo: ultima ? (
        <InterpretacaoView
          analise={{ ...paraAnalise(ultima), prnt: ultima.prnt, incorp: ultima.incorporacao }}
          cultura={cultura}
          tabelas={tabelas}
          contexto={{
            produtor: produtor?.nome ?? '—',
            talhao: talhao.nome as string,
            areaHa: Number(talhao.area_ha ?? 0),
            data: dataBR(ultima.data_coleta),
            profundidade: ultima.profundidade ?? '0–20',
            prodEsperadaTalhao: Number(ultima.prod_esperada ?? talhao.prod_esperada ?? 0) || undefined,
          }}
        />
      ) : (
        <Vazio titulo="Sem análise de solo para este talhão">
          <Link href="/app/analises/nova">Lançar análise.</Link>
        </Vazio>
      ),
    },
    {
      id: 'historico',
      rotulo: 'Histórico',
      contagem: timeline.length,
      conteudo: timeline.length === 0 ? (
        <Vazio titulo="Nada registrado ainda para este talhão" />
      ) : (
        <Cartao olho="Prontuário" titulo="Linha do tempo">
          <div className="lista">
            {timeline.map((ev, i) => (
              <div className="item" key={i}>
                <div className="cresce">
                  <h3>{dataBR(ev.data)}</h3>
                  <small>{ev.rotulo}</small>
                </div>
                {ev.href ? <Link className="btn sec mini" href={ev.href}>abrir</Link> : null}
              </div>
            ))}
          </div>
        </Cartao>
      ),
    },
    {
      id: 'recomendacoes',
      rotulo: 'Recomendações',
      contagem: recomendacoes.length,
      conteudo: recomendacoes.length === 0 ? (
        <Vazio titulo="Nenhuma recomendação emitida para este talhão" />
      ) : (
        <div className="lista">
          {recomendacoes.map((r) => {
            const res = r.resultado as Partial<Recomendacao> & Record<string, unknown>;
            const cal = res.calagem as { corrigido?: number } | undefined;
            const corretivo = res.corretivo as { corretivo?: string } | undefined;
            const ad = res.adubacao as { N?: number; P2O5?: number; K2O?: number } | undefined;
            return (
              <div className="item" key={r.id}>
                <div className="cresce">
                  <h3>Emitida em {dataBR(r.emitida_em.slice(0, 10))}</h3>
                  <small className="mono">
                    {cal?.corrigido != null ? `calcário ${f(cal.corrigido, 1)} t/ha` : ''}
                    {corretivo?.corretivo ? ` (${nomeCorretivo(corretivo.corretivo as never).toLowerCase()})` : ''}
                    {ad ? ` · N ${ad.N} · P₂O₅ ${ad.P2O5} · K₂O ${ad.K2O} kg/ha` : ''}
                  </small>
                </div>
                <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'monitoramento',
      rotulo: 'Monitoramento',
      contagem: visitas.length,
      conteudo: (
        <>
          {visitas.length === 0 ? (
            <Vazio titulo="Nenhuma visita registrada para este talhão" />
          ) : (
            <div className="lista">
              {visitas.map((v) => {
                const acima = (v.ocorrencias ?? []).filter((o) => o.acima_nivel).length;
                return (
                  <div className="item" key={v.id}>
                    <div className="cresce">
                      <h3>{dataBR(v.data)} — {v.fenologia ?? 'estádio não informado'}</h3>
                      <small>condição {v.condicao ?? '—'}{v.observacoes ? ` · ${v.observacoes}` : ''}</small>
                    </div>
                    {acima > 0 ? <Tag tom="ruim">{acima} acima do nível</Tag> : <Tag>sob controle</Tag>}
                  </div>
                );
              })}
            </div>
          )}

          <Cartao olho="Novo" titulo="Registrar visita" style={{ marginTop: 14 }}>
            <form action={registrarVisita} className="grade g2">
              <input type="hidden" name="talhao_id" value={id} />
              <div className="campo"><label htmlFor="v_data">Data</label><input id="v_data" name="data" type="date" required /></div>
              <div className="campo"><label htmlFor="v_fenologia">Estádio fenológico</label><input id="v_fenologia" name="fenologia" autoComplete="off" /></div>
              <div className="campo">
                <label htmlFor="v_condicao">Condição geral</label>
                <select id="v_condicao" name="condicao" defaultValue="">
                  <option value="">—</option>
                  <option value="Boa">Boa</option>
                  <option value="Regular">Regular</option>
                  <option value="Preocupante">Preocupante</option>
                </select>
              </div>
              <div className="campo"><label htmlFor="v_proxima">Próxima visita (opcional)</label><input id="v_proxima" name="proxima_visita" type="date" /></div>
              <div className="campo" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="v_obs">Observações</label>
                <input id="v_obs" name="observacoes" autoComplete="off" />
              </div>
              <div className="campo" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="v_rec">Recomendação de campo (opcional)</label>
                <input id="v_rec" name="recomendacao" autoComplete="off" />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <p className="nota" style={{ margin: '4px 0 8px' }}>Ocorrências observadas (opcional, até 3):</p>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input name={`oc${i}_alvo`} placeholder="alvo — ex.: lagarta, ferrugem" style={{ flex: 2, minWidth: 160 }} autoComplete="off" />
                    <input name={`oc${i}_valor`} placeholder="valor — ex.: 3 por planta" style={{ flex: 1, minWidth: 120 }} autoComplete="off" />
                    <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="checkbox" name={`oc${i}_acima`} /> acima do nível
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar visita</button></div>
            </form>
          </Cartao>
        </>
      ),
    },
    {
      id: 'fotos',
      rotulo: 'Fotos',
      contagem: todasFotos.length,
      conteudo: todasFotos.length === 0 ? (
        <Vazio titulo="Nenhuma foto registrada" />
      ) : (
        <div className="grade g4">
          {todasFotos.map((ft) => {
            const url = urlsFotos.get(ft.storage_path);
            return (
              <div className="cartao" key={ft.id} style={{ padding: 8 }}>
                {/* URL assinada do Storage, host desconhecido em build-time — next/image exigiria remotePatterns por projeto */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url ? <img src={url} alt={ft.legenda ?? 'foto da visita'} style={{ width: '100%', borderRadius: 6, display: 'block' }} /> : null}
                {ft.legenda ? <p className="nota" style={{ margin: '6px 0 0' }}>{ft.legenda}</p> : null}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'custos',
      rotulo: 'Custos',
      conteudo: (
        <Vazio titulo="Custos não ficam visíveis pra você, por padrão">
          O financeiro do produtor (<code>financeiro_lancamentos</code>) é isolado por desenho — nenhum
          consultor tem acesso, nem leitura, salvo se o produtor decidir compartilhar explicitamente algum
          dia (ainda não existe essa opção). Não é uma tela que falta construir.
        </Vazio>
      ),
    },
    {
      id: 'producao',
      rotulo: 'Produção',
      contagem: producao.length,
      conteudo: producao.length === 0 ? (
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
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href={produtor ? `/app/produtores/${produtor.id}` : '/app/talhoes'}>
          ← {propriedade?.nome ?? 'Talhões'}
        </Link>
      </div>

      <BannerHero imagem={FOTO_CONSULTOR}
        olho={`${produtor?.nome ?? '—'} · ${nomeCultura(talhao.cultura as string | null)}`}
        titulo={talhao.nome as string}
        descricao={`${f(Number(talhao.area_ha ?? 0), 1)} ha${talhao.ano_implantacao ? ` · plantado em ${talhao.ano_implantacao}` : ''}${talhao.espacamento ? ` · ${talhao.espacamento}` : ''}`}
        acoes={
          <>
            <Tag tom={situacao.tom}>{situacao.txt}</Tag>
            <Link className="btn sec" href={`/app/talhoes/${id}/editar`}>Editar</Link>
          </>
        }
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
