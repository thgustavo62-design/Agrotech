import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarPedido } from '@/lib/connect-dados';
import { ROTULO_CATEGORIA } from '@/lib/connect';
import { dataBR } from '@/lib/formato';
import { Anexos, Conversa, FormResposta, LinhaDoTempo, SeloPrioridade, SeloStatus } from '@/components/connect/pedido-ui';
import { avaliarPedido } from '../../acoes';
import { BotaoEnviar } from '@/components/connect/botao-enviar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedido · AgroTech Connect' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PedidoDoProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const perfil = await perfilAtual();
  if (perfil?.role === 'consultor' || perfil?.role === 'admin') redirect(`/connect/atendimentos/${id}`);

  const sb = await criarClienteServidor();
  const p = await carregarPedido(sb, id);
  if (!p) notFound();
  const semNomes = new Map<string, string>();

  return (
    <main className="cn-principal cn-estreito">
      <p className="cn-migalha"><Link href="/connect">Connect</Link> / <Link href="/connect/pedidos">Meus pedidos</Link></p>

      <header className="cn-cabeca-pedido">
        <h1>{p.assunto}</h1>
        <div className="cn-selos">
          <SeloStatus status={p.status} visao="produtor" />
          <SeloPrioridade prioridade={p.prioridade} />
          <span className="nota">{ROTULO_CATEGORIA[p.categoria]} · enviado em {dataBR(p.criado_em.slice(0, 10))}</span>
        </div>
        {p.status === 'aguardando_produtor' ? <p className="cn-destaque-linha">O técnico precisa de uma informação sua — responda abaixo.</p> : null}
        {p.vencimento && p.status !== 'resolvido' && p.status !== 'arquivado' ? <p className="nota">Prazo previsto para a resposta: {dataBR(p.vencimento)}</p> : null}
      </header>

      {(p.propriedade || p.talhao || p.descricao || p.arquivosDoPedido.length > 0) ? (
        <section className="cn-bloco" aria-label="O que você enviou">
          {p.propriedade || p.talhao ? <p className="nota">{[p.propriedade, p.talhao ? `${p.talhao}${p.cultura ? ` (${p.cultura})` : ''}` : null].filter(Boolean).join(' · ')}</p> : null}
          {p.descricao ? <p className="cn-texto">{p.descricao}</p> : null}
          <Anexos arquivos={p.arquivosDoPedido} />
        </section>
      ) : null}

      <section className="cn-bloco" aria-labelledby="titulo-conversa">
        <h2 id="titulo-conversa">Conversa</h2>
        <Conversa mensagens={p.mensagens} visao="produtor" nomes={semNomes} />
        {p.status === 'arquivado' ? (
          <p className="nota">Este pedido foi arquivado. Para tratar de outro assunto, <Link href="/connect/pedidos/novo">abra um novo pedido</Link>.</p>
        ) : (
          <FormResposta pedidoId={p.id} visao="produtor" rotuloBotao={p.status === 'resolvido' ? 'Reabrir com uma mensagem' : 'Enviar mensagem'} />
        )}
      </section>

      {p.status === 'resolvido' ? (
        <section className="cn-bloco" aria-labelledby="titulo-avaliacao">
          <h2 id="titulo-avaliacao">Como foi o atendimento?</h2>
          {p.avaliado_em ? (
            <p>Você avaliou com <b>{p.avaliacao} de 5</b>.{p.avaliacao_comentario ? <> “{p.avaliacao_comentario}”</> : null} Obrigado!</p>
          ) : (
            <form action={avaliarPedido} className="cn-avaliacao">
              <input type="hidden" name="pedido_id" value={p.id} />
              <fieldset className="cn-estrelas">
                <legend className="cn-rotulo">Sua nota</legend>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n}><input type="radio" name="nota" value={n} required /><span>{n}</span></label>
                ))}
              </fieldset>
              <label className="cn-rotulo">
                Quer comentar? <span className="cn-opcional">(opcional)</span>
                <textarea name="comentario" rows={3} maxLength={600} />
              </label>
              <div><BotaoEnviar>Enviar avaliação</BotaoEnviar></div>
            </form>
          )}
        </section>
      ) : null}

      <section className="cn-bloco" aria-labelledby="titulo-historico">
        <h2 id="titulo-historico">Histórico</h2>
        <LinhaDoTempo eventos={p.eventos} visao="produtor" nomes={semNomes} />
      </section>
    </main>
  );
}
