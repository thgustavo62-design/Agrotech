import { criarClienteServidor, produtorAtual, perfilAtual } from '@/lib/supabase/server';
import { dataBR, hojeISO as dataDeHoje } from '@/lib/formato';
import { resumoFinanceiro } from '@/lib/financeiro';
import { temFeature } from '@/lib/planos';

export const ESTADO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};
export function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()),
  );
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export async function carregarInicioProdutor() {
  const sb = await criarClienteServidor();
  const [perfil, produtor] = await Promise.all([perfilAtual(), produtorAtual()]);

  const hojeISO = dataDeHoje();
  const financeiroHabilitado = await temFeature(sb, 'financeiro');
  const [{ data: talhoes }, { data: recs }, { data: docsRaw }, { data: eventosRaw }, resumoFin] = await Promise.all([
    sb.schema('agro').from('vw_talhao_situacao')
      .select('talhao_id, nome, cultura, area_ha, data_coleta, situacao')
      .order('nome'),
    sb.schema('agro').from('recomendacoes')
      .select('id, emitida_em, analise:analise_id(talhao:talhao_id(nome, cultura))')
      .is('arquivada_em', null)
      .order('emitida_em', { ascending: false })
      .limit(3),
    sb.schema('agro').from('documentos')
      .select('id, nome_arquivo, laboratorio, status, criado_em')
      .order('criado_em', { ascending: false })
      .limit(3),
    sb.schema('agro').from('agenda_eventos')
      .select('id, titulo, data, tipo')
      .eq('status', 'planejado').gte('data', hojeISO)
      .order('data', { ascending: true }).limit(1),
    produtor && financeiroHabilitado ? resumoFinanceiro(sb, produtor.id) : Promise.resolve(null),
  ]);

  const lista = (talhoes ?? []) as Array<{
    talhao_id: string; nome: string; cultura: string | null;
    area_ha: number | null; data_coleta: string | null; situacao: string;
  }>;
  const recomendacoes = (recs ?? []) as unknown as Array<{
    id: string; emitida_em: string; analise: { talhao: { nome: string; cultura: string | null } | null } | null;
  }>;
  const documentos = (docsRaw ?? []) as Array<{
    id: string; nome_arquivo: string | null; laboratorio: string | null; status: string; criado_em: string;
  }>;
  const proximoEvento = ((eventosRaw ?? []) as Array<{ id: string; titulo: string; data: string; tipo: string }>)[0];

  const areaTotal = lista.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const culturas = [...new Set(lista.map((t) => t.cultura).filter((c): c is string => Boolean(c)))];
  const precisamCorrecao = lista.filter((t) => t.situacao === 'precisa_correcao');

  const hojeMenos14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const recomendacaoRecente = recomendacoes.find((r) => r.emitida_em >= hojeMenos14);
  const documentoRecente = documentos.find((d) => d.status === 'confirmado' && d.criado_em >= hojeMenos14);

  type Atencao = { chave: string; texto: string; href?: string };
  const atencao: Atencao[] = [
    ...precisamCorrecao.map((t): Atencao => ({
      chave: `talhao-${t.talhao_id}`,
      texto: `${t.nome} precisa de correção — fale com o seu técnico.`,
      href: '/produtor/talhoes',
    })),
    ...(recomendacaoRecente ? [{
      chave: `rec-${recomendacaoRecente.id}`,
      texto: `Seu agrônomo publicou uma nova recomendação para ${recomendacaoRecente.analise?.talhao?.nome ?? 'um talhão'}.`,
      href: `/produtor/laudos/${recomendacaoRecente.id}`,
    }] : []),
    ...(documentoRecente ? [{
      chave: `doc-${documentoRecente.id}`,
      texto: 'Há uma análise de solo nova disponível.',
      href: '/produtor/documentos',
    }] : []),
    ...(proximoEvento ? [{
      chave: `evento-${proximoEvento.id}`,
      texto: `${proximoEvento.tipo === 'visita' ? 'Visita técnica' : proximoEvento.titulo} marcada para ${dataBR(proximoEvento.data)}.`,
    }] : []),
  ];

  return {
    perfil,
    resumoFin,
    lista,
    recomendacoes,
    documentos,
    areaTotal,
    culturas,
    precisamCorrecao,
    atencao,
  };
}

export type ContextoInicioProdutor = Awaited<ReturnType<typeof carregarInicioProdutor>>;
