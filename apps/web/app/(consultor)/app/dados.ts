import { after } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR, diasDepoisISO } from '@/lib/formato';
import { type AtividadeBruta } from '@/lib/atividade';
import { pctTendencia } from '@/lib/tendencia';

export interface ItemLista {
  talhao_id: string; nome: string; data?: string | null;
  analise_id?: string | null; cultura?: string | null; v?: number | null; m?: number | null; data_coleta?: string | null;
}
export interface Painel {
  produtores: number;
  talhoes: number;
  area_total: number;
  analises: number;
  laudos_fila: number;
  pendencias: ItemLista[];
  area_por_cultura: Record<string, number>;
  visitas_atrasadas_total: number;
  visitas_atrasadas: ItemLista[];
  proximas_visitas: ItemLista[];
  recomendacoes_pendentes_total: number;
  recomendacoes_pendentes: ItemLista[];
  recomendacoes_emitidas_mes: number;
  produtores_sem_visita_recente: number;
  talhoes_sem_analise_atualizada: number;
  atividade_recente: AtividadeBruta[];
}
export const VAZIO: Painel = {
  produtores: 0, talhoes: 0, area_total: 0, analises: 0, laudos_fila: 0,
  pendencias: [], area_por_cultura: {},
  visitas_atrasadas_total: 0, visitas_atrasadas: [], proximas_visitas: [],
  recomendacoes_pendentes_total: 0, recomendacoes_pendentes: [], recomendacoes_emitidas_mes: 0,
  produtores_sem_visita_recente: 0, talhoes_sem_analise_atualizada: 0, atividade_recente: [],
};

export async function carregarPainel() {
  const sb = await criarClienteServidor();
  // escrita do snapshot diário: roda depois de enviar a página (antes era um `await` na frente de tudo)
  after(async () => { await sb.schema('agro').rpc('registrar_metricas_hoje'); });

  const limite25dias = diasDepoisISO(-25);
  const [{ data }, { data: snapAnterior }] = await Promise.all([
    sb.schema('agro').rpc('painel_consultor'),
    sb.schema('agro').from('metricas_diarias')
      .select('produtores, talhoes, analises, recomendacoes_emitidas_mes')
      .lte('data', limite25dias).order('data', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const p = (data as Painel | null) ?? VAZIO;

  const tendencia = (atual: number, anterior: number | null | undefined) => {
    const pct = pctTendencia(atual, anterior);
    return pct != null ? { pct, rotulo: 'vs. mês anterior' } : undefined;
  };

  const culturas = Object.entries(p.area_por_cultura).sort((a, b) => b[1] - a[1]);

  type Atencao = { chave: string; nome: string; texto: string; tom: 'ruim' | 'alerta' | 'cinza'; href?: string };
  const atencao: Atencao[] = [
    ...p.pendencias.map((x): Atencao => ({
      chave: `crit-${x.talhao_id}`, nome: x.nome, tom: 'ruim',
      texto: `precisa de correção — V ${x.v != null ? f(x.v, 0) : '—'}% · m ${x.m != null ? f(x.m, 0) : '—'}%`,
      href: x.analise_id ? `/app/analises/${x.analise_id}` : `/app/talhoes/${x.talhao_id}`,
    })),
    ...p.visitas_atrasadas.map((x): Atencao => ({
      chave: `atraso-${x.talhao_id}`, nome: x.nome, tom: 'ruim',
      texto: `retorno previsto para ${dataBR(x.data ?? '')} — ainda sem novo registro`,
      href: `/app/talhoes/${x.talhao_id}`,
    })),
    ...p.recomendacoes_pendentes.map((x): Atencao => ({
      chave: `rec-${x.analise_id}`, nome: x.nome, tom: 'alerta',
      texto: `análise de ${x.data_coleta ? dataBR(x.data_coleta) : '—'} sem recomendação emitida`,
      href: `/app/analises/${x.analise_id}`,
    })),
    ...p.proximas_visitas.map((x): Atencao => ({
      chave: `prox-${x.talhao_id}`, nome: x.nome, tom: 'cinza',
      texto: `visita prevista para ${dataBR(x.data ?? '')}`,
      href: `/app/talhoes/${x.talhao_id}`,
    })),
  ];

  return {
    snapAnterior,
    p,
    tendencia,
    culturas,
    atencao,
  };
}

export type ContextoPainel = Awaited<ReturnType<typeof carregarPainel>>;
