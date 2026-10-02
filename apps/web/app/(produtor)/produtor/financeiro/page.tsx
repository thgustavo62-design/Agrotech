import { PrecisaUpgrade } from '@/components/precisa-upgrade';
import Link from 'next/link';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { carregarFinanceiro } from './dados';
import { PainelResumo } from './paineis/Resumo';
import { PainelLancamentos } from './paineis/Lancamentos';
import { PainelContasCategorias } from './paineis/ContasCategorias';
import { PainelOrcamento } from './paineis/Orcamento';

export const dynamic = 'force-dynamic';

export default async function FinanceiroProdutor() {
  const ctx = await carregarFinanceiro();
  if (ctx.bloqueado) {
    return (
    <PrecisaUpgrade
      titulo="Financeiro"
      descricao="Lançamentos, contas, categorias e orçamento da sua produção — só você vê."
    />
    );
  }
  const { lancamentos, orcamentos } = ctx;

  const paineis: Painel[] = [
    {
      id: 'resumo',
      rotulo: 'Resumo',
      conteudo: <PainelResumo ctx={ctx} />,
    },
    {
      id: 'lancamentos',
      rotulo: 'Lançamentos',
      contagem: lancamentos.length,
      conteudo: <PainelLancamentos ctx={ctx} />,
    },
    {
      id: 'contas-categorias',
      rotulo: 'Contas & categorias',
      conteudo: <PainelContasCategorias ctx={ctx} />,
    },
    {
      id: 'orcamento',
      rotulo: 'Orçamento',
      contagem: orcamentos.length,
      conteudo: <PainelOrcamento ctx={ctx} />,
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/produtor">← Início</Link>
      </div>

      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo="Financeiro"
        descricao="Só você vê estas informações — nem o seu técnico tem acesso a esta aba."
        tags={['Privado', 'Fluxo de caixa', 'Controle']}
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
