import { calcular } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { diasDepoisISO } from '@/lib/formato';

export type Analise = {
  id: string; data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null; s: number | null;
};
export type Talhao = {
  id: string; nome: string; cultura: string | null; area_ha: number | null;
  propriedade: { nome: string; produtor: { id: string; nome: string } | null } | null;
  analises: Analise[];
};
export type Recomendacao = {
  id: string; resultado: {
    diagnostico?: Array<{ g: string; txt: string }>;
    totais?: { calcario_t?: number; gesso_t?: number; N_kg?: number; P2O5_kg?: number; K2O_kg?: number };
  };
  analise: { talhao: { cultura: string | null } | null } | null;
};

export async function carregarInteligencia({
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
  const hojeMenos180 = diasDepoisISO(-180);
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

  return {
    filtro,
    culturasPresentes,
    talhoes,
    resumos,
    ROTULO_SITUACAO,
    foraDaMeta,
    produtoresSemAnaliseRecente,
    deficienciasComuns,
    resumoCulturas,
  };
}

export type ContextoInteligencia = Awaited<ReturnType<typeof carregarInteligencia>>;
