import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarEquipe, carregarPedido } from '@/lib/connect-dados';
import { pode } from '@/lib/permissoes';
import { ROTULO_CATEGORIA, ROTULO_STATUS, STATUS, estaAtrasado, linkWhatsApp, textoParaWhatsApp } from '@/lib/connect';
import { dataBR, hojeISO } from '@/lib/formato';
import { Anexos, Conversa, FormResposta, LinhaDoTempo, SeloPrioridade, SeloStatus } from '@/components/connect/pedido-ui';
import { BotaoEnviar } from '@/components/connect/botao-enviar';
import { agendarRetorno, assumirPedido, atualizarPedido, mudarSituacao } from '../../acoes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atendimento · AgroTech Connect' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Atendimento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const perfil = await perfilAtual();
  if (!perfil) redirect('/connect');
  if (perfil.role === 'produtor') redirect(`/connect/pedidos/${id}`);

  const sb = await criarClienteServidor();
  const [p, equipe] = await Promise.all([carregarPedido(sb, id), carregarEquipe(sb)]);
  if (!p) notFound();
  const nomes = new Map(equipe.map((m) => [m.id, m.nome]));
  const podeGerir = pode(perfil.perfis, 'atendimento.gerir');
  const atrasado = estaAtrasado(p, hojeISO());
  const whats = linkWhatsApp(p.produtor_fone, textoParaWhatsApp(p.produtor, p.assunto));
  const meu = p.responsavel_id === perfil.id;

  return (
    <main className="cn-principal cn-largo">
      <p className="cn-migalha"><Link href="/connect/fila">Fila de atendimento</Link> / {p.produtor ?? 'Produtor'}</p>

      <header className="cn-cabeca-pedido">
        <h1>{p.assunto}</h1>
        <div className="cn-selos">
          <SeloStatus status={p.status} visao="equipe" />
          <SeloPrioridade prioridade={p.prioridade} />
          {atrasado ? <span className="tag ruim">prazo vencido</span> : null}
          <span className="nota">{ROTULO_CATEGORIA[p.categoria]} · {p.origem === 'equipe' ? 'aberto pela equipe' : p.origem === 'atlas' ? 'veio de uma ficha do Atlas' : 'pedido do produtor'} · {dataBR(p.criado_em.slice(0, 10))}</span>
        </div>
      </header>

      <div className="cn-duas-colunas">
        <div className="cn-coluna-principal">
          {(p.descricao || p.arquivosDoPedido.length > 0) ? (
            <section className="cn-bloco" aria-label="O pedido">
              {p.descricao ? <p className="cn-texto">{p.descricao}</p> : null}
              <Anexos arquivos={p.arquivosDoPedido} />
            </section>
          ) : null}

          <section className="cn-bloco" aria-labelledby="titulo-conversa">
            <h2 id="titulo-conversa">Conversa</h2>
            <Conversa mensagens={p.mensagens} visao="equipe" nomes={nomes} />
            {!podeGerir ? (
              <p className="nota">Seu perfil só consulta os atendimentos. Peça ao proprietário do escritório para atender pedidos.</p>
            ) : p.status === 'arquivado' ? (
              <p className="nota">Pedido arquivado: não recebe novas mensagens.</p>
            ) : (
              <FormResposta pedidoId={p.id} visao="equipe" rotuloBotao="Enviar resposta" />
            )}
          </section>

          <section className="cn-bloco" aria-labelledby="titulo-historico">
            <h2 id="titulo-historico">Histórico</h2>
            <LinhaDoTempo eventos={p.eventos} visao="equipe" nomes={nomes} />
          </section>
        </div>

        <aside className="cn-lateral" aria-label="Gestão do atendimento">
          <section className="cn-bloco">
            <h2>Produtor</h2>
            <p><b>{p.produtor ?? '—'}</b></p>
            {p.propriedade || p.talhao ? <p className="nota">{[p.propriedade, p.talhao ? `${p.talhao}${p.cultura ? ` (${p.cultura})` : ''}` : null].filter(Boolean).join(' · ')}</p> : null}
            <div className="cn-acoes-linha">
              <Link className="btn sec mini" href={`/app/produtores/${p.produtor_id}`}>Ver cadastro</Link>
              {whats ? <a className="btn sec mini" href={whats} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <span className="nota">Sem celular cadastrado</span>}
            </div>
            {p.avaliado_em ? <p className="nota">Avaliação do produtor: <b>{p.avaliacao}/5</b>{p.avaliacao_comentario ? ` — “${p.avaliacao_comentario}”` : ''}</p> : null}
          </section>

          {podeGerir ? (
            <>
              <section className="cn-bloco">
                <h2>Situação</h2>
                <form action={mudarSituacao} className="cn-forma-linha">
                  <input type="hidden" name="pedido_id" value={p.id} />
                  <select name="status" defaultValue={p.status} aria-label="Situação do pedido">
                    {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s].equipe}</option>)}
                  </select>
                  <BotaoEnviar className="btn sec" ocupado="Salvando…">Mudar</BotaoEnviar>
                </form>
              </section>

              <section className="cn-bloco">
                <h2>Responsável, prioridade e prazo</h2>
                {!meu ? (
                  <form action={assumirPedido}>
                    <input type="hidden" name="pedido_id" value={p.id} />
                    <BotaoEnviar className="btn verde mini" ocupado="Assumindo…">Assumir este atendimento</BotaoEnviar>
                  </form>
                ) : <p className="nota">Este atendimento é seu.</p>}
                <form action={atualizarPedido} className="cn-forma">
                  <input type="hidden" name="pedido_id" value={p.id} />
                  <label className="cn-rotulo">Responsável
                    <select name="responsavel_id" defaultValue={p.responsavel_id ?? ''}>
                      <option value="">Sem responsável</option>
                      {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </label>
                  <label className="cn-rotulo">Prioridade
                    <select name="prioridade" defaultValue={p.prioridade}>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>
                  <label className="cn-rotulo">Prazo
                    <input type="date" name="vencimento" defaultValue={p.vencimento ?? ''} />
                  </label>
                  <div><BotaoEnviar className="btn sec" ocupado="Salvando…">Salvar</BotaoEnviar></div>
                </form>
              </section>

              <section className="cn-bloco">
                <h2>Retorno na agenda</h2>
                <form action={agendarRetorno} className="cn-forma-linha">
                  <input type="hidden" name="pedido_id" value={p.id} />
                  <input type="date" name="data" required aria-label="Data do retorno" defaultValue={p.vencimento ?? ''} />
                  <BotaoEnviar className="btn sec" ocupado="Marcando…">Marcar</BotaoEnviar>
                </form>
                <p className="nota">Cria um evento “retorno” na agenda do escritório.</p>
              </section>
            </>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
