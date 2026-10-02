import { notFound } from 'next/navigation';
import { calcular } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { hojeISO as dataDeHoje } from '@/lib/formato';
import { type AtividadeBruta } from '@/lib/atividade';

export type AnaliseRow = {
  id: string; data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null; s: number | null;
};
export type TalhaoRow = {
  id: string; nome: string; cultura: string | null; area_ha: number | null; prod_esperada: number | null;
  propriedade: { id: string; nome: string | null } | null;
  analises: AnaliseRow[];
};
export type Situacao = 'precisa_correcao' | 'atencao' | 'em_ordem' | 'sem_analise';
export const SITUACAO: Record<Situacao, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  atencao: { txt: 'fósforo baixo', tom: 'alerta' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export async function carregarProdutor({ params }: { params: Promise<{ id: string }> }) {
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

  const hojeISO = dataDeHoje();

  const ultimaVisita = [...visitas].sort((a, b) => b.data.localeCompare(a.data))[0];

  const proximaVisita = visitas.map((v) => v.proxima_visita).filter((d): d is string => d != null && d >= hojeISO).sort()[0];

  const recomendacoes = (recsRaw ?? []) as unknown as Array<{
    id: string; analise_id: string; emitida_em: string; motor_versao: string; resultado: Record<string, unknown>;
    analise: { talhao: { nome: string; cultura: string | null } | null } | null;
  }>;

  const documentos = (docsRaw ?? []) as Array<{
    id: string; nome_arquivo: string | null; laboratorio: string | null; status: string; confianca_media: number | null; criado_em: string;
  }>;

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

  return {
    id,
    prod,
    comps,
    convites,
    tabelas,
    talhoes,
    propriedades,
    visitas,
    resumos,
    porCultura,
    culturasOrdenadas,
    areaTotal,
    totalAnalises,
    nCritico,
    nAtencao,
    situacaoGeral,
    ultimaVisita,
    proximaVisita,
    recomendacoes,
    documentos,
    atividade,
    appUrl,
    seta,
  };
}

export type ContextoProdutor = Awaited<ReturnType<typeof carregarProdutor>>;
