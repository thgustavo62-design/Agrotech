import { notFound } from 'next/navigation';
import { calcular } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { paraAnalise } from '@/lib/culturas';

export type LinhaAnalise = {
  id: string; data_coleta: string; profundidade: string | null; laboratorio: string | null;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null;
  s: number | null; b: number | null; zn: number | null; cu: number | null; mn: number | null; fe: number | null;
  prnt: number | null; incorporacao: number | null; prod_esperada: number | null;
};
export type LinhaRecomendacao = { id: string; analise_id: string; emitida_em: string; resultado: unknown };
export type LinhaOcorrencia = { alvo: string; valor: string | null; acima_nivel: boolean };
export type LinhaFoto = { id: string; storage_path: string; legenda: string | null; lat: number | null; lng: number | null };
export type LinhaVisita = {
  id: string; data: string; fenologia: string | null; condicao: string | null;
  observacoes: string | null; recomendacao: string | null; proxima_visita: string | null;
  ocorrencias: LinhaOcorrencia[]; fotos: LinhaFoto[];
};
export const SITUACAO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  atencao: { txt: 'fósforo baixo', tom: 'alerta' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export async function carregarTalhao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  // Tudo que só depende do id do talhão sai numa rodada só (antes eram 3 rodadas em fila: talhão/análises/visitas,
  // depois recomendações, depois produção). Só as URLs das fotos dependem do resultado das visitas.
  const [{ data: talhao, error }, { data: analisesRaw }, { data: visitasRaw }, tabelas, { data: recsRaw }, { data: producaoRaw }] = await Promise.all([
    sb.schema('agro').from('talhoes').select(
      `id, nome, cultura, variedade, area_ha, prod_esperada, espacamento, ano_implantacao, obs,
       propriedade:propriedade_id ( id, nome, municipio, produtor:produtor_id ( id, nome ) )`,
    ).eq('id', id).single(),
    sb.schema('agro').from('analises')
      .select('id, data_coleta, profundidade, laboratorio, argila, ph, mo, p, k, na, ca, mg, al, h_al, s, b, zn, cu, mn, fe, prnt, incorporacao, prod_esperada')
      .eq('talhao_id', id).is('arquivado_em', null)
      .order('data_coleta', { ascending: false }),
    sb.schema('agro').from('visitas')
      .select('id, data, fenologia, condicao, observacoes, recomendacao, proxima_visita, ocorrencias:visita_ocorrencias(alvo, valor, acima_nivel), fotos:visita_fotos(id, storage_path, legenda, lat, lng)')
      .eq('talhao_id', id).order('data', { ascending: false }),
    tabelasDaOrg(sb),
    // recomendações das análises (não arquivadas) deste talhão, por junção — sem esperar a lista de análises
    sb.schema('agro').from('recomendacoes')
      .select('id, analise_id, emitida_em, resultado, analise:analise_id!inner(talhao_id, arquivado_em)')
      .eq('analise.talhao_id', id).is('analise.arquivado_em', null).is('arquivada_em', null)
      .order('emitida_em', { ascending: false }),
    // Produção: só os campos agronômicos (agro.producao_visivel_consultor nunca
    // seleciona preço/receita/observação — ver DATABASE_CHANGES.md §0022).
    sb.schema('agro').rpc('producao_visivel_consultor'),
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

  const recomendacoes = (recsRaw ?? []) as unknown as LinhaRecomendacao[];

  const todasFotos = visitas.flatMap((v) => v.fotos ?? []);
  let urlsFotos = new Map<string, string | null>();
  if (todasFotos.length) {
    const { data: assinadas } = await sb.storage.from('visitas')
      .createSignedUrls(todasFotos.map((ft) => ft.storage_path), 3600);
    urlsFotos = new Map((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));
  }

  const proximaVisita = visitas.find((v) => v.proxima_visita)?.proxima_visita ?? null;

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

  return {
    id,
    talhao,
    tabelas,
    propriedade,
    produtor,
    visitas,
    ultima,
    cultura,
    calc,
    V2,
    mMax,
    situacao,
    recomendacoes,
    todasFotos,
    urlsFotos,
    proximaVisita,
    producao,
    timeline,
  };
}

export type ContextoTalhao = Awaited<ReturnType<typeof carregarTalhao>>;
