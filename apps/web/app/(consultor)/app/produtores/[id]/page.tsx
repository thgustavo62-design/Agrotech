import Link from 'next/link';
import { nomeCultura } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Tag } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { carregarProdutor } from './dados';
import { PainelResumo } from './paineis/Resumo';
import { PainelPropriedades } from './paineis/Propriedades';
import { PainelTalhoes } from './paineis/Talhoes';
import { PainelAnalises } from './paineis/Analises';
import { PainelRecomendacoes } from './paineis/Recomendacoes';
import { PainelVisitas } from './paineis/Visitas';
import { PainelDocumentos } from './paineis/Documentos';
import { PainelAcesso } from './paineis/Acesso';
import { PainelLinhaDoTempo } from './paineis/LinhaDoTempo';

export const dynamic = 'force-dynamic';

export default async function PaginaProdutor({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await carregarProdutor({ params });
  const { id, prod, talhoes, propriedades, visitas, culturasOrdenadas, areaTotal, totalAnalises, situacaoGeral, ultimaVisita, proximaVisita, recomendacoes, documentos } = ctx;

  const paineis: Painel[] = [
    {
      id: 'resumo',
      rotulo: 'Resumo',
      conteudo: <PainelResumo ctx={ctx} />,
    },
    {
      id: 'propriedades',
      rotulo: 'Propriedades',
      contagem: propriedades.length,
      conteudo: <PainelPropriedades ctx={ctx} />,
    },
    {
      id: 'talhoes',
      rotulo: 'Talhões',
      contagem: talhoes.length,
      conteudo: <PainelTalhoes ctx={ctx} />,
    },
    {
      id: 'analises',
      rotulo: 'Análises',
      contagem: totalAnalises,
      conteudo: <PainelAnalises ctx={ctx} />,
    },
    {
      id: 'recomendacoes',
      rotulo: 'Recomendações',
      contagem: recomendacoes.length,
      conteudo: <PainelRecomendacoes ctx={ctx} />,
    },
    {
      id: 'visitas',
      rotulo: 'Visitas',
      contagem: visitas.length,
      conteudo: <PainelVisitas ctx={ctx} />,
    },
    {
      id: 'documentos',
      rotulo: 'Documentos',
      contagem: documentos.length,
      conteudo: <PainelDocumentos ctx={ctx} />,
    },
    {
      id: 'acesso',
      rotulo: 'Acesso',
      conteudo: <PainelAcesso ctx={ctx} />,
    },
    {
      id: 'linha-do-tempo',
      rotulo: 'Linha do tempo',
      conteudo: <PainelLinhaDoTempo ctx={ctx} />,
    },
  ];


  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/app/produtores">← Produtores</Link>
      </div>

      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Produtor"
        titulo={prod.nome}
        descricao={
          <>
            {[prod.email, prod.fone, prod.cpf_cnpj].filter(Boolean).join(' · ') || 'sem contato cadastrado'}
            {' · '}{f(areaTotal, 1)} ha assistidos
            {ultimaVisita ? ` · última visita ${dataBR(ultimaVisita.data)}` : ''}
            {proximaVisita ? ` · próxima em ${dataBR(proximaVisita)}` : ''}
          </>
        }
        tags={culturasOrdenadas.filter((c) => c !== '__sem').map((c) => nomeCultura(c))}
        acoes={
          <>
            <Tag tom={situacaoGeral.tom}>{situacaoGeral.txt}</Tag>
            <Link className="btn sec" href={`/app/produtores/${id}/editar`}>Editar</Link>
            <Link className="btn sec" prefetch={false} href={`/app/produtores/${id}/exportar`}>Exportar dados</Link>
          </>
        }
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
