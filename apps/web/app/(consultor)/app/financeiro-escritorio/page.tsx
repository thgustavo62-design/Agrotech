import { PrecisaUpgrade } from '@/components/precisa-upgrade';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { carregarFinanceiroEscritorio } from './dados';
import { PainelResumo } from './paineis/Resumo';
import { PainelLancamentos } from './paineis/Lancamentos';
import { PainelContasCategorias } from './paineis/ContasCategorias';

export const dynamic = 'force-dynamic';

export default async function FinanceiroEscritorio() {
  const ctx = await carregarFinanceiroEscritorio();
  if (ctx.bloqueado) {
    return (
    <PrecisaUpgrade
      titulo="Financeiro do escritório"
      descricao="Cobrança dos seus clientes e despesas do próprio negócio — separado do financeiro de cada produtor."
    />
    );
  }
  const { lancamentos } = ctx;

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
  ];

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Escritório"
        titulo="Financeiro"
        descricao="Cobrança dos seus clientes e despesas do próprio negócio — separado do financeiro de cada produtor, que é privado e não passa por aqui."
        tags={['Fluxo de caixa', 'Cobrança', 'Despesas']}
      />

      <AbasPaineis paineis={paineis} />
    </>
  );
}
