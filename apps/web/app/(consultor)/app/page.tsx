import Link from 'next/link';
import { f } from '@/lib/formato';
import { Grade, Metrica } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { IconeProdutores, IconeTalhoes, IconeAnalises, IconeRecomendacoes } from '@/components/icones';
import { carregarPainel } from './dados';
import { PrecisaDaSuaAtencao } from './secoes/PrecisaDaSuaAtencao';
import { AreaEAtividade } from './secoes/AreaEAtividade';

export const dynamic = 'force-dynamic';

export default async function PaginaPainel() {
  const ctx = await carregarPainel();
  const { snapAnterior, p, tendencia } = ctx;

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Central do agrônomo"
        titulo="Início"
        descricao="O que pede a sua atenção hoje na assistência técnica."
        tags={['Planejamento', 'Conhecimento', 'Resultados']}
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
        <Metrica rotulo="Produtores" valor={p.produtores} icone={IconeProdutores} tendencia={tendencia(p.produtores, snapAnterior?.produtores)} />
        <Metrica rotulo="Talhões" valor={p.talhoes} detalhe={`${f(p.area_total, 1)} ha`} icone={IconeTalhoes} tendencia={tendencia(p.talhoes, snapAnterior?.talhoes)} />
        <Metrica rotulo="Análises" valor={p.analises} icone={IconeAnalises} tendencia={tendencia(p.analises, snapAnterior?.analises)} />
        <Metrica rotulo="Recomendações no mês" valor={p.recomendacoes_emitidas_mes} icone={IconeRecomendacoes} tendencia={tendencia(p.recomendacoes_emitidas_mes, snapAnterior?.recomendacoes_emitidas_mes)} />
      </Grade>

      <PrecisaDaSuaAtencao ctx={ctx} />

      <AreaEAtividade ctx={ctx} />
    </>
  );
}
