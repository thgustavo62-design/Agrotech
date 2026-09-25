import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel as AbaPainel } from '@/components/abas-paineis';
import { KanbanPendencias, type ColunaPendencias } from '@/components/kanban-pendencias';

export const dynamic = 'force-dynamic';

interface ItemLista {
  talhao_id: string; nome: string; data?: string | null;
  analise_id?: string | null; cultura?: string | null; v?: number | null; m?: number | null; data_coleta?: string | null;
}
interface PainelRPC {
  pendencias: ItemLista[];
  visitas_atrasadas: ItemLista[];
  recomendacoes_pendentes: ItemLista[];
  proximas_visitas: ItemLista[];
}

/** Mesma fila de trabalho de /app, com o detalhe completo por categoria — crítico, atenção e programado. */
export default async function Pendencias() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').rpc('painel_consultor');
  const p = (data as PainelRPC | null) ?? { pendencias: [], visitas_atrasadas: [], recomendacoes_pendentes: [], proximas_visitas: [] };

  type Item = { chave: string; nome: string; texto: string; href?: string };
  const criticos: Item[] = [
    ...p.pendencias.map((x): Item => ({
      chave: `crit-${x.talhao_id}`, nome: x.nome,
      texto: `V ${x.v != null ? f(x.v, 0) : '—'}% · m ${x.m != null ? f(x.m, 0) : '—'}%${x.cultura ? ` · ${nomeCultura(x.cultura)}` : ''}`,
      href: x.analise_id ? `/app/analises/${x.analise_id}` : `/app/talhoes/${x.talhao_id}`,
    })),
    ...p.visitas_atrasadas.map((x): Item => ({
      chave: `atraso-${x.talhao_id}`, nome: x.nome,
      texto: `retorno previsto para ${dataBR(x.data ?? '')} — ainda sem novo registro`,
      href: `/app/talhoes/${x.talhao_id}`,
    })),
  ];
  const atencao: Item[] = p.recomendacoes_pendentes.map((x): Item => ({
    chave: `rec-${x.analise_id}`, nome: x.nome,
    texto: `análise de ${x.data_coleta ? dataBR(x.data_coleta) : '—'} sem recomendação emitida`,
    href: `/app/analises/${x.analise_id}`,
  }));
  const programado: Item[] = p.proximas_visitas.map((x): Item => ({
    chave: `prox-${x.talhao_id}`, nome: x.nome,
    texto: `visita prevista para ${dataBR(x.data ?? '')}`,
    href: `/app/talhoes/${x.talhao_id}`,
  }));

  const secao = (titulo: string, itens: Item[], tom: 'ruim' | 'alerta' | 'cinza') => itens.length === 0 ? null : (
    <Cartao olho={`${itens.length} item(ns)`} titulo={titulo} style={{ marginTop: 14 }}>
      <div className="lista">
        {itens.map((it) => (
          <div className="item" key={it.chave}>
            <div className="cresce">
              <h3>{it.nome}</h3>
              <small className="mono">{it.texto}</small>
            </div>
            <Tag tom={tom}>{tom === 'ruim' ? 'crítico' : tom === 'alerta' ? 'atenção' : 'programado'}</Tag>
            {it.href ? <Link className="btn sec mini" href={it.href}>abrir</Link> : null}
          </div>
        ))}
      </div>
    </Cartao>
  );

  const total = criticos.length + atencao.length + programado.length;

  const paineis: AbaPainel[] = [
    {
      id: 'lista',
      rotulo: 'Lista',
      conteudo: total === 0 ? <Vazio titulo="Nada pendente agora" /> : (
        <>
          {secao('Crítico', criticos, 'ruim')}
          {secao('Atenção', atencao, 'alerta')}
          {secao('Programado', programado, 'cinza')}
        </>
      ),
    },
    {
      id: 'kanban',
      rotulo: 'Kanban',
      conteudo: (
        <KanbanPendencias
          colunas={[
            { id: 'critico', titulo: 'Crítico', tom: 'ruim', itens: criticos },
            { id: 'atencao', titulo: 'Atenção', tom: 'alerta', itens: atencao },
            { id: 'programado', titulo: 'Programado', tom: 'cinza', itens: programado },
          ] satisfies ColunaPendencias[]}
        />
      ),
    },
  ];

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Fila de trabalho"
        titulo="Pendências"
        descricao="Talhões fora da meta, recomendações sem emitir e visitas programadas — tudo que pede sua atenção."
        tags={['Prioridade', 'Ação', 'Acompanhamento']}
      />
      <AbasPaineis paineis={paineis} />
    </>
  );
}
