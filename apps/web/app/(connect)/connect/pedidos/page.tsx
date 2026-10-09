import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarPedidos } from '@/lib/connect-dados';
import { ehAberto } from '@/lib/connect';
import { LinhaDePedido } from '@/components/connect/pedido-ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus pedidos · AgroTech Connect' };

export default async function MeusPedidos() {
  const perfil = await perfilAtual();
  if (perfil?.role === 'consultor' || perfil?.role === 'admin') redirect('/connect/fila');

  const sb = await criarClienteServidor();
  const pedidos = await carregarPedidos(sb);
  const abertos = pedidos.filter((p) => ehAberto(p.status));
  const encerrados = pedidos.filter((p) => !ehAberto(p.status));

  return (
    <main className="cn-principal">
      <div className="cn-bloco-cabeca">
        <h1>Meus pedidos</h1>
        <Link className="btn verde" href="/connect/pedidos/novo">Novo pedido</Link>
      </div>

      {pedidos.length === 0 ? (
        <div className="vazio"><b>Você ainda não fez nenhum pedido</b><p>Clique em “Novo pedido” para falar com o seu técnico.</p></div>
      ) : (
        <>
          <section className="cn-bloco" aria-labelledby="titulo-abertos">
            <h2 id="titulo-abertos">Em aberto ({abertos.length})</h2>
            {abertos.length === 0 ? <p className="nota">Nenhum pedido em aberto.</p> : <ul className="cn-lista">{abertos.map((p) => <LinhaDePedido key={p.id} p={p} />)}</ul>}
          </section>
          {encerrados.length > 0 ? (
            <section className="cn-bloco" aria-labelledby="titulo-encerrados">
              <h2 id="titulo-encerrados">Resolvidos e arquivados ({encerrados.length})</h2>
              <ul className="cn-lista">{encerrados.map((p) => <LinhaDePedido key={p.id} p={p} />)}</ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
