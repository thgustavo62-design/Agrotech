import Link from 'next/link';
import { calcular } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero } from '@/components/banner-hero';

export const dynamic = 'force-dynamic';

type Analise = {
  id: string; data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null; s: number | null;
};
type Talhao = {
  id: string; nome: string; cultura: string | null; area_ha: number | null;
  propriedade: { nome: string; produtor: { id: string; nome: string } | null } | null;
  analises: Analise[];
};
type Recomendacao = {
  id: string; resultado: {
    diagnostico?: Array<{ g: string; txt: string }>;
    totais?: { calcario_t?: number; gesso_t?: number; N_kg?: number; P2O5_kg?: number; K2O_kg?: number };
  };
  analise: { talhao: { cultura: string | null } | null } | null;
};

export default async function Inteligencia({
  searchParams,
}: {
  searchParams: Promise<{ cultura?: string }>;
}) {
  const { cultura: filtro } = await searchParams;
  const sb = await criarClienteServidor();

  const [{ data: talhoesRaw }, { data: recsRaw }, tabelas] = await Promise.all([
    sb.schema('agro').from('talhoes').select(
      `id, nome, cultura, area_ha,
       propriedade:propriedade_id(nome, produtor:produtor_id(id, nome)),
       analises:analises(id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s)`,
    ),
    sb.schema('agro').from('recomendacoes')
      .select('id, resultado, analise:analise_id(talhao:talhao_id(cultura))')
      .is('arquivada_em', null),
    tabelasDaOrg(sb),
  ]);

  const todosTalhoes = (talhoesRaw ?? []) as unknown as Talhao[];
  const culturasPresentes = [...new Set(todosTalhoes.map((t) => t.cultura ?? '__sem'))]
    .sort((a, b) => nomeCultura(a).localeCompare(nomeCultura(b)));
  const talhoes = filtro ? todosTalhoes.filter((t) => (t.cultura ?? '__sem') === filtro) : todosTalhoes;

  const resumos = talhoes.map((t) => {
    const ordenadas = [...(t.analises ?? [])].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta));
    const ultima = ordenadas[0];
    const cult = t.cultura ? tabelas.culturas[t.cultura] : undefined;
    const V2 = cult?.V2 ?? 60;
    const mMax = cult?.m_max ?? 20;
    if (!ultima) return { talhao: t, ultima: undefined, r: undefined, situacao: 'sem_analise' as const };
    const r = calcular(paraAnalise(ultima), tabelas);
    const situacao = (r.V < V2 - 10 || r.m > mMax) ? 'precisa_correcao' as const
      : r.classeP <= 1 ? 'fosforo_baixo' as const
      : r.classeK <= 1 ? 'potassio_baixo' as const
      : 'em_ordem' as const;
    return { talhao: t, ultima, r, situacao };
  });

  const ROTULO_SITUACAO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
    precisa_correcao: { txt: 'V/m fora da meta', tom: 'ruim' },
    fosforo_baixo: { txt: 'fósforo baixo', tom: 'alerta' },
    potassio_baixo: { txt: 'potássio baixo', tom: 'alerta' },
    em_ordem: { txt: 'em ordem', tom: 'ok' },
    sem_analise: { txt: 'sem análise', tom: 'cinza' },
  };
  const foraDaMeta = resumos.filter((x) => x.situacao === 'precisa_correcao' || x.situacao === 'fosforo_baixo' || x.situacao === 'potassio_baixo')
    .sort((a, b) => (a.situacao === 'precisa_correcao' ? 0 : 1) - (b.situacao === 'precisa_correcao' ? 0 : 1));

  // produtores sem análise recente (180 dias, mesmo limiar de painel_consultor())
  const hojeMenos180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const porProdutor = new Map<string, { nome: string; ultimaData: string | null }>();
  for (const t of talhoes) {
    const produtor = t.propriedade?.produtor;
    if (!produtor) continue;
    const ultimaDoTalhao = [...(t.analises ?? [])].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))[0]?.data_coleta ?? null;
    const atual = porProdutor.get(produtor.id);
    if (!atual) {
      porProdutor.set(produtor.id, { nome: produtor.nome, ultimaData: ultimaDoTalhao });
    } else if (ultimaDoTalhao && (!atual.ultimaData || ultimaDoTalhao > atual.ultimaData)) {
      atual.ultimaData = ultimaDoTalhao;
    }
  }
  const produtoresSemAnaliseRecente = [...porProdutor.values()]
    .filter((p) => !p.ultimaData || p.ultimaData < hojeMenos180)
    .sort((a, b) => (a.ultimaData ?? '').localeCompare(b.ultimaData ?? ''));

  // deficiências mais comuns (crítico) — de recomendacoes.resultado.diagnostico
  const recomendacoes = (recsRaw ?? []) as unknown as Recomendacao[];
  const recsFiltradas = filtro ? recomendacoes.filter((r) => (r.analise?.talhao?.cultura ?? '__sem') === filtro) : recomendacoes;
  const tallyDiagnostico = new Map<string, number>();
  for (const r of recsFiltradas) {
    for (const d of r.resultado?.diagnostico ?? []) {
      if (d.g !== 'crit') continue;
      tallyDiagnostico.set(d.txt, (tallyDiagnostico.get(d.txt) ?? 0) + 1);
    }
  }
  const deficienciasComuns = [...tallyDiagnostico.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // área / calcário / fertilizante estimado por cultura
  const porCultura = new Map<string, { area: number; calcario: number; gesso: number; N: number; P2O5: number; K2O: number }>();
  for (const t of todosTalhoes) {
    const chave = t.cultura ?? '__sem';
    if (!porCultura.has(chave)) porCultura.set(chave, { area: 0, calcario: 0, gesso: 0, N: 0, P2O5: 0, K2O: 0 });
    porCultura.get(chave)!.area += Number(t.area_ha ?? 0);
  }
  for (const r of recomendacoes) {
    const chave = r.analise?.talhao?.cultura ?? '__sem';
    const acc = porCultura.get(chave);
    if (!acc) continue;
    const tot = r.resultado?.totais;
    if (!tot) continue;
    acc.calcario += Number(tot.calcario_t ?? 0);
    acc.gesso += Number(tot.gesso_t ?? 0);
    acc.N += Number(tot.N_kg ?? 0);
    acc.P2O5 += Number(tot.P2O5_kg ?? 0);
    acc.K2O += Number(tot.K2O_kg ?? 0);
  }
  const resumoCulturas = [...porCultura.entries()]
    .filter(([, v]) => v.area > 0)
    .sort((a, b) => b[1].area - a[1].area);

  return (
    <>
      <BannerHero
        olho="Sua carteira"
        titulo="Inteligência"
        descricao="Consultas sobre toda a carteira — talhões fora da meta, deficiências mais comuns, insumo estimado por cultura."
        tags={['Análise', 'Padrões', 'Carteira']}
        acoes={<Link className="btn sec" href="/app/relatorios">Relatórios</Link>}
      />

      {culturasPresentes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Link className="aba" data-ativa={!filtro} href="/app/inteligencia">Todas as culturas</Link>
          {culturasPresentes.map((c) => (
            <Link key={c} className="aba" data-ativa={filtro === c} href={`/app/inteligencia?cultura=${encodeURIComponent(c)}`}>
              {nomeCultura(c === '__sem' ? null : c)}
            </Link>
          ))}
        </div>
      )}

      <Grade cols={4}>
        <Metrica rotulo="Talhões analisados" valor={resumos.filter((x) => x.ultima).length} detalhe={`de ${talhoes.length}`} />
        <Metrica rotulo="Fora da meta" valor={foraDaMeta.length} cor={foraDaMeta.length ? 'var(--c-mb)' : undefined} />
        <Metrica rotulo="Produtores sem análise recente" valor={produtoresSemAnaliseRecente.length} cor={produtoresSemAnaliseRecente.length ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Área na carteira" valor={`${f(talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0), 1)} ha`} />
      </Grade>

      <Cartao olho="Fila de correção" titulo="Talhões fora da meta" style={{ marginTop: 14 }}>
        {foraDaMeta.length === 0 ? (
          <Vazio titulo="Nada fora da meta na carteira" />
        ) : (
          <div className="lista">
            {foraDaMeta.slice(0, 15).map((x) => {
              const s = ROTULO_SITUACAO[x.situacao]!;
              return (
                <div className="item" key={x.talhao.id}>
                  <div className="cresce">
                    <h3>{x.talhao.nome}</h3>
                    <small>
                      {x.talhao.propriedade?.produtor?.nome ?? '—'} · {nomeCultura(x.talhao.cultura)}
                      {x.r ? ` · V ${f(x.r.V, 0)}% · m ${f(x.r.m, 0)}%` : ''}
                    </small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                  <Link className="btn sec mini" href={`/app/talhoes/${x.talhao.id}`}>abrir</Link>
                </div>
              );
            })}
          </div>
        )}
        {foraDaMeta.length > 15 && <p className="nota" style={{ marginTop: 10 }}>+{foraDaMeta.length - 15} outro(s).</p>}
      </Cartao>

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

      <Cartao olho="Estimativa" titulo="Área, calcário e fertilizante por cultura" style={{ marginTop: 14 }}>
        {resumoCulturas.length === 0 ? (
          <Vazio titulo="Nenhum dado ainda" />
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Cultura</th><th className="num">Área</th><th className="num">Calcário</th>
                  <th className="num">Gesso</th><th className="num">N</th><th className="num">P₂O₅</th><th className="num">K₂O</th>
                </tr>
              </thead>
              <tbody>
                {resumoCulturas.map(([c, v]) => (
                  <tr key={c}>
                    <td>{nomeCultura(c === '__sem' ? null : c)}</td>
                    <td className="num">{f(v.area, 1)} ha</td>
                    <td className="num">{f(v.calcario, 1)} t</td>
                    <td className="num">{f(v.gesso, 1)} t</td>
                    <td className="num">{f(v.N, 0)} kg</td>
                    <td className="num">{f(v.P2O5, 0)} kg</td>
                    <td className="num">{f(v.K2O, 0)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota" style={{ marginTop: 10 }}>
          Soma dos totais já calculados em cada recomendação emitida (dose/ha × área do talhão) — não é uma
          nova estimativa, é o mesmo número que já está em cada laudo.
        </p>
      </Cartao>
    </>
  );
}
