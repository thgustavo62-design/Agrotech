import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { rotuloAtividade, linkAtividade, type AtividadeBruta } from '@/lib/atividade';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface ItemLista {
  talhao_id: string; nome: string; data?: string | null;
  analise_id?: string | null; cultura?: string | null; v?: number | null; m?: number | null; data_coleta?: string | null;
}
interface Painel {
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

const VAZIO: Painel = {
  produtores: 0, talhoes: 0, area_total: 0, analises: 0, laudos_fila: 0,
  pendencias: [], area_por_cultura: {},
  visitas_atrasadas_total: 0, visitas_atrasadas: [], proximas_visitas: [],
  recomendacoes_pendentes_total: 0, recomendacoes_pendentes: [], recomendacoes_emitidas_mes: 0,
  produtores_sem_visita_recente: 0, talhoes_sem_analise_atualizada: 0, atividade_recente: [],
};


export default async function PaginaPainel() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').rpc('painel_consultor');
  const p = (data as Painel | null) ?? VAZIO;

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

  return (
    <>
      <CabecalhoVista
        olho="Central do agrônomo"
        titulo="Início"
        descricao="O que pede a sua atenção hoje na assistência técnica."
        acoes={
          <>
            <Link className="btn verde" href="/app/analises/nova">Lançar análise</Link>
            <Link className="btn sec" href="/app/laudos/novo">Enviar laudo (PDF)</Link>
          </>
        }
      />

      <Grade cols={4}>
        <Metrica rotulo="Pendências químicas" valor={p.pendencias.length} cor={p.pendencias.length ? 'var(--c-mb)' : undefined} />
        <Metrica rotulo="Laudos na fila" valor={p.laudos_fila} cor={p.laudos_fila ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Recomendações pendentes" valor={p.recomendacoes_pendentes_total} cor={p.recomendacoes_pendentes_total ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Visitas atrasadas" valor={p.visitas_atrasadas_total} cor={p.visitas_atrasadas_total ? 'var(--c-mb)' : undefined} />
      </Grade>
      <Grade cols={4} style={{ marginTop: 12 }}>
        <Metrica rotulo="Produtores" valor={p.produtores} />
        <Metrica rotulo="Talhões" valor={p.talhoes} detalhe={`${f(p.area_total, 1)} ha`} />
        <Metrica rotulo="Análises" valor={p.analises} />
        <Metrica rotulo="Recomendações no mês" valor={p.recomendacoes_emitidas_mes} />
      </Grade>

      <Cartao olho="Fila de trabalho" titulo="Precisa da sua atenção" style={{ marginTop: 14 }}>
        {(p.talhoes_sem_analise_atualizada > 0 || p.produtores_sem_visita_recente > 0) && (
          <p className="nota" style={{ margin: '0 0 12px' }}>
            {p.talhoes_sem_analise_atualizada > 0 ? `${p.talhoes_sem_analise_atualizada} talhão(ões) sem análise há mais de 6 meses` : ''}
            {p.talhoes_sem_analise_atualizada > 0 && p.produtores_sem_visita_recente > 0 ? ' · ' : ''}
            {p.produtores_sem_visita_recente > 0 ? `${p.produtores_sem_visita_recente} produtor(es) sem visita há mais de 60 dias` : ''}
          </p>
        )}
        {atencao.length === 0 ? (
          <Vazio titulo="Nada pedindo atenção agora">
            Sem correção pendente, sem laudo represado, sem visita atrasada.
          </Vazio>
        ) : (
          <div className="lista">
            {atencao.map((it) => (
              <div className="item" key={it.chave}>
                <div className="cresce">
                  <h3>{it.nome}</h3>
                  <small>{it.texto}</small>
                </div>
                <Tag tom={it.tom}>{it.tom === 'ruim' ? 'crítico' : it.tom === 'alerta' ? 'atenção' : 'programado'}</Tag>
                {it.href ? <Link className="btn sec mini" href={it.href}>abrir</Link> : null}
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
        {culturas.length > 0 && (
          <Cartao olho="Composição" titulo="Área por cultura">
            <div className="lista">
              {culturas.map(([c, area]) => {
                const pct = p.area_total > 0 ? (100 * area) / p.area_total : 0;
                return (
                  <div className="item" key={c}>
                    <div className="cresce">
                      <h3>{nomeCultura(c)}</h3>
                      <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, marginTop: 6 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--folha)', borderRadius: 99 }} />
                      </div>
                    </div>
                    <span className="mono nota">{f(area, 1)} ha · {f(pct, 0)}%</span>
                  </div>
                );
              })}
            </div>
          </Cartao>
        )}

        <Cartao olho="Prontuário do escritório" titulo="Atividade recente">
          {p.atividade_recente.length === 0 ? (
            <Vazio titulo="Nada registrado ainda" />
          ) : (
            <div className="lista">
              {p.atividade_recente.map((a, i) => {
                const rotulo = rotuloAtividade(a);
                const href = linkAtividade(a);
                return (
                  <div className="item" key={i}>
                    <div className="cresce">
                      <h3 style={{ fontSize: 13.5 }}>{rotulo}</h3>
                      <small>{dataBR(a.criado_em.slice(0, 10))} às {a.criado_em.slice(11, 16)}</small>
                    </div>
                    {href ? <Link className="btn sec mini" href={href}>abrir</Link> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>
      </Grade>
    </>
  );
}
