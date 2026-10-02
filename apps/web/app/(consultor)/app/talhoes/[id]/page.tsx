import Link from 'next/link';
import { nomeCultura } from '@/lib/culturas';
import { f } from '@/lib/formato';
import { Tag } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { carregarTalhao } from './dados';
import { PainelGeral } from './paineis/Geral';
import { PainelSolo } from './paineis/Solo';
import { PainelHistorico } from './paineis/Historico';
import { PainelRecomendacoes } from './paineis/Recomendacoes';
import { PainelMonitoramento } from './paineis/Monitoramento';
import { PainelFotos } from './paineis/Fotos';
import { PainelCustos } from './paineis/Custos';
import { PainelProducao } from './paineis/Producao';

export const dynamic = 'force-dynamic';

export default async function TalhaoPagina({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await carregarTalhao({ params });
  const { id, talhao, propriedade, produtor, visitas, situacao, recomendacoes, todasFotos, producao, timeline } = ctx;

  const paineis: Painel[] = [
    {
      id: 'geral',
      rotulo: 'Visão geral',
      conteudo: <PainelGeral ctx={ctx} />,
    },
    {
      id: 'solo',
      rotulo: 'Solo & Nutrição',
      conteudo: <PainelSolo ctx={ctx} />,
    },
    {
      id: 'historico',
      rotulo: 'Histórico',
      contagem: timeline.length,
      conteudo: <PainelHistorico ctx={ctx} />,
    },
    {
      id: 'recomendacoes',
      rotulo: 'Recomendações',
      contagem: recomendacoes.length,
      conteudo: <PainelRecomendacoes ctx={ctx} />,
    },
    {
      id: 'monitoramento',
      rotulo: 'Monitoramento',
      contagem: visitas.length,
      conteudo: <PainelMonitoramento ctx={ctx} />,
    },
    {
      id: 'fotos',
      rotulo: 'Fotos',
      contagem: todasFotos.length,
      conteudo: <PainelFotos ctx={ctx} />,
    },
    {
      id: 'custos',
      rotulo: 'Custos',
      conteudo: <PainelCustos ctx={ctx} />,
    },
    {
      id: 'producao',
      rotulo: 'Produção',
      contagem: producao.length,
      conteudo: <PainelProducao ctx={ctx} />,
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
