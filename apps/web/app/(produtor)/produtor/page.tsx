import Link from 'next/link';
import { f, moeda } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { Cartao, Grade, Metrica } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { IconeTalhoes, IconeRecomendacoes } from '@/components/icones';
import { carregarInicioProdutor, saudacao } from './dados';
import { PrecisaDaSuaAtencao } from './secoes/PrecisaDaSuaAtencao';
import { RecomendacoesEDocumentos } from './secoes/RecomendacoesEDocumentos';
import { SituacaoDosTalhoes } from './secoes/SituacaoDosTalhoes';

export const dynamic = 'force-dynamic';

export default async function PainelProdutor() {
  const ctx = await carregarInicioProdutor();
  const { perfil, resumoFin, lista, recomendacoes, areaTotal, culturas } = ctx;

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo={`${saudacao()}, ${perfil?.nome ?? 'produtor'}.`}
        descricao={
          <>
            {f(areaTotal, 1)} ha assistidos
            {culturas.length > 0 ? ` · ${culturas.map((c) => nomeCultura(c)).join(', ')}` : ''}
          </>
        }
        tags={['Solo', 'Safra', 'Resultado']}
      />

      <Grade cols={2} style={{ marginBottom: 14 }}>
        <Metrica rotulo="Talhões acompanhados" valor={lista.length} detalhe={`${f(areaTotal, 1)} ha`} icone={IconeTalhoes} />
        <Metrica rotulo="Recomendações recebidas" valor={recomendacoes.length} icone={IconeRecomendacoes} />
      </Grade>

      <PrecisaDaSuaAtencao ctx={ctx} />

      <RecomendacoesEDocumentos ctx={ctx} />

      {resumoFin && (
        <Cartao olho="Resumo financeiro" titulo={moeda(resumoFin.saldo)} style={{ marginTop: 14 }}>
          <p className="nota" style={{ margin: 0 }}>
            {resumoFin.pendencias > 0
              ? `${resumoFin.pendencias} lançamento(s) a vencer ou atrasado(s).`
              : 'Nenhum lançamento pendente.'}
          </p>
          <Link className="btn sec mini" href="/produtor/financeiro" style={{ marginTop: 10 }}>
            Abrir o financeiro
          </Link>
        </Cartao>
      )}

      <SituacaoDosTalhoes ctx={ctx} />
    </>
  );
}
