import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarPedidos } from '@/lib/connect-dados';
import { ehAberto } from '@/lib/connect';
import { LinhaDePedido } from '@/components/connect/pedido-ui';

export const dynamic = 'force-dynamic';

/** Início do Connect: a equipe cai direto na fila; o produtor vê o convite para pedir ajuda e os pedidos recentes. */
export default async function InicioConnect() {
  const perfil = await perfilAtual();
  if (perfil?.role === 'consultor' || perfil?.role === 'admin') redirect('/connect/fila');

  const sb = await criarClienteServidor();
  const pedidos = await carregarPedidos(sb, { limite: 50 });
  const abertos = pedidos.filter((p) => ehAberto(p.status));
  const precisamDeVoce = pedidos.filter((p) => p.status === 'aguardando_produtor');
  const recentes = pedidos.slice(0, 4);

  return (
    <main className="cn-principal">
      <section className="cn-hero">
        <div>
          <p className="cn-olho">Fale com o seu técnico</p>
          <h1>Como podemos ajudar{perfil?.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}?</h1>
          <p>Conte o que está acontecendo, mande uma foto e acompanhe a resposta por aqui. Seu pedido fica registrado e ninguém se esquece dele.</p>
        </div>
        <Link className="btn verde cn-hero-botao" href="/connect/pedidos/novo">Fazer um pedido</Link>
      </section>

      {precisamDeVoce.length > 0 ? (
        <section className="cn-destaque" aria-label="Precisamos de você">
          <b>O técnico precisa de uma informação sua</b>
          <ul>
            {precisamDeVoce.map((p) => <li key={p.id}><Link href={`/connect/pedidos/${p.id}`}>{p.assunto}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section className="cn-bloco" aria-labelledby="titulo-recentes">
        <div className="cn-bloco-cabeca">
          <h2 id="titulo-recentes">Seus pedidos</h2>
          {pedidos.length > recentes.length ? <Link href="/connect/pedidos">Ver todos ({pedidos.length})</Link> : null}
        </div>
        {recentes.length === 0 ? (
          <div className="vazio"><b>Você ainda não fez nenhum pedido</b><p>Quando fizer, ele aparece aqui com a situação e as respostas.</p></div>
        ) : (
          <>
            <p className="nota">{abertos.length === 0 ? 'Nenhum pedido em aberto.' : `${abertos.length} em aberto.`}</p>
            <ul className="cn-lista">{recentes.map((p) => <LinhaDePedido key={p.id} p={p} />)}</ul>
          </>
        )}
      </section>
    </main>
  );
}
