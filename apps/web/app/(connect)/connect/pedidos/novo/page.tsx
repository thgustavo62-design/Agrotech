import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarLocais } from '@/lib/connect-dados';
import { CATEGORIAS, type CategoriaPedido } from '@/lib/connect';
import { FormPedido } from '@/components/connect/form-pedido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Novo pedido · AgroTech Connect' };

export default async function NovoPedido({ searchParams }: { searchParams: Promise<{ categoria?: string; assunto?: string; talhao?: string; origem?: string }> }) {
  const perfil = await perfilAtual();
  if (perfil?.role === 'consultor' || perfil?.role === 'admin') redirect('/connect/atendimentos/novo');

  const { categoria, assunto, talhao, origem } = await searchParams;
  const inicial = (CATEGORIAS as string[]).includes(categoria ?? '') ? (categoria as CategoriaPedido) : 'duvida';
  const sb = await criarClienteServidor();
  const { propriedades, talhoes } = await carregarLocais(sb);

  return (
    <main className="cn-principal cn-estreito">
      <p className="cn-migalha"><Link href="/connect">Connect</Link> / Novo pedido</p>
      <h1>Novo pedido</h1>
      <p className="cn-sub">Quanto mais você contar (e mostrar), mais rápido o técnico consegue ajudar. Pode mandar foto direto do celular.</p>
      <FormPedido propriedades={propriedades} talhoes={talhoes} categoriaInicial={inicial} assuntoInicial={assunto?.slice(0, 160)} talhaoInicial={talhao} origem={origem === 'atlas' ? 'atlas' : undefined} />
    </main>
  );
}
