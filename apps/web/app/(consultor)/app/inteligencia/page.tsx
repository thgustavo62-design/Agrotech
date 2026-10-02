import Link from 'next/link';
import { nomeCultura } from '@/lib/culturas';
import { f } from '@/lib/formato';
import { Grade, Metrica } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { carregarInteligencia } from './dados';
import { TalhoesForaDaMeta } from './secoes/TalhoesForaDaMeta';
import { DeficienciasEProdutoresSemAnalise } from './secoes/DeficienciasEProdutoresSemAnalise';
import { EstimativaPorCultura } from './secoes/EstimativaPorCultura';

export const dynamic = 'force-dynamic';

export default async function Inteligencia({
  searchParams,
}: {
  searchParams: Promise<{ cultura?: string }>;
}) {
  const ctx = await carregarInteligencia({ searchParams });
  const { filtro, culturasPresentes, talhoes, resumos, foraDaMeta, produtoresSemAnaliseRecente } = ctx;

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
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

      <TalhoesForaDaMeta ctx={ctx} />

      <DeficienciasEProdutoresSemAnalise ctx={ctx} />

      <EstimativaPorCultura ctx={ctx} />
    </>
  );
}
