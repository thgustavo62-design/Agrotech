import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarEquipe, carregarPedidos } from '@/lib/connect-dados';
import {
  COLUNAS_DA_FILA, ROTULO_STATUS, ROTULO_CATEGORIA, agruparPorStatus, diasParado, estaAtrasado, filtrarFila, resumirFila,
  type FiltroFila,
} from '@/lib/connect';
import { dataBR, hojeISO } from '@/lib/formato';
import { SeloPrioridade } from '@/components/connect/pedido-ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fila de atendimento · AgroTech Connect' };

type Busca = { quem?: string; prioridade?: string; q?: string; atrasados?: string; arquivados?: string };

export default async function FilaDeAtendimento({ searchParams }: { searchParams: Promise<Busca> }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/connect');
  if (perfil.role === 'produtor') redirect('/connect');

  const busca = await searchParams;
  const quem = busca.quem === 'meus' || busca.quem === 'sem_responsavel' ? busca.quem : 'todos';
  const filtro: FiltroFila = { quem, prioridade: busca.prioridade || undefined, busca: busca.q, atrasados: busca.atrasados === '1' };
  const verArquivados = busca.arquivados === '1';

  const sb = await criarClienteServidor();
  const [todos, equipe] = await Promise.all([carregarPedidos(sb, { limite: 500 }), carregarEquipe(sb)]);
  const nome = new Map(equipe.map((m) => [m.id, m.nome]));
  const hoje = hojeISO();
  const agora = new Date();

  const resumo = resumirFila(todos, hoje);
  const filtrados = filtrarFila(todos, filtro, perfil.id, hoje);
  const grupos = agruparPorStatus(filtrados);
  const arquivados = grupos.arquivado;

  const link = (mudanca: Partial<Busca>) => {
    const q = new URLSearchParams();
    const nova = { ...busca, ...mudanca };
    for (const [k, v] of Object.entries(nova)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/connect/fila?${s}` : '/connect/fila';
  };

  return (
    <main className="cn-principal cn-largo">
      <div className="cn-bloco-cabeca">
        <h1>Fila de atendimento</h1>
        <Link className="btn verde" href="/connect/atendimentos/novo">Novo atendimento</Link>
      </div>

      <section className="cn-resumo" aria-label="Resumo da fila">
        <Link prefetch={false} href={link({ quem: undefined, atrasados: undefined, prioridade: undefined })}><b>{resumo.abertos}</b><span>em aberto</span></Link>
        <Link prefetch={false} href={link({ quem: 'sem_responsavel', atrasados: undefined })} className={resumo.semResponsavel > 0 ? 'cn-resumo-alerta' : ''}><b>{resumo.semResponsavel}</b><span>sem responsável</span></Link>
        <Link prefetch={false} href={link({ atrasados: '1' })} className={resumo.atrasados > 0 ? 'cn-resumo-ruim' : ''}><b>{resumo.atrasados}</b><span>com prazo vencido</span></Link>
        <Link prefetch={false} href={link({ prioridade: 'urgente' })} className={resumo.urgentes > 0 ? 'cn-resumo-ruim' : ''}><b>{resumo.urgentes}</b><span>urgentes</span></Link>
        <span><b>{resumo.aguardandoProdutor}</b><span>aguardando o produtor</span></span>
      </section>

      <form className="cn-filtros" method="get" action="/connect/fila" role="search">
        <input type="search" name="q" defaultValue={busca.q ?? ''} placeholder="Buscar por assunto ou produtor" aria-label="Buscar pedidos" autoComplete="off" />
        <select name="quem" defaultValue={quem} aria-label="Responsável">
          <option value="todos">Todos</option>
          <option value="meus">Meus</option>
          <option value="sem_responsavel">Sem responsável</option>
        </select>
        <select name="prioridade" defaultValue={busca.prioridade ?? ''} aria-label="Prioridade">
          <option value="">Qualquer prioridade</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
        </select>
        <label className="cn-marcar"><input type="checkbox" name="atrasados" value="1" defaultChecked={filtro.atrasados} /> Só atrasados</label>
        <button className="btn sec" type="submit">Filtrar</button>
        <Link className="btn sec" href="/connect/fila">Limpar</Link>
      </form>

      <div className="cn-quadro">
        {COLUNAS_DA_FILA.map((status) => (
          <section key={status} className="cn-coluna" aria-labelledby={`col-${status}`}>
            <h2 id={`col-${status}`}>{ROTULO_STATUS[status].equipe} <span className="cn-coluna-n">{grupos[status].length}</span></h2>
            {grupos[status].length === 0 ? <p className="nota cn-coluna-vazia">Nada por aqui.</p> : (
              <ul>
                {grupos[status].map((p) => {
                  const atrasado = estaAtrasado(p, hoje);
                  const parado = diasParado(p.ultima_interacao_em, agora);
                  return (
                    <li key={p.id}>
                      <Link className={`cn-card ${atrasado ? 'cn-card-atrasado' : ''}`} href={`/connect/atendimentos/${p.id}`}>
                        <span className="cn-card-titulo">{p.assunto}</span>
                        <span className="cn-card-produtor">{p.produtor ?? 'Produtor'} · {ROTULO_CATEGORIA[p.categoria]}</span>
                        <span className="cn-card-meta">
                          <SeloPrioridade prioridade={p.prioridade} />
                          <span className={p.responsavel_id ? '' : 'cn-sem-resp'}>{p.responsavel_id ? (nome.get(p.responsavel_id) ?? 'Responsável') : 'Sem responsável'}</span>
                        </span>
                        <span className="cn-card-meta nota">
                          {p.vencimento ? <span className={atrasado ? 'cn-vencido' : ''}>{atrasado ? 'Venceu' : 'Prazo'} {dataBR(p.vencimento)}</span> : <span>Sem prazo</span>}
                          {status !== 'resolvido' && parado >= 2 ? <span>parado há {parado} dias</span> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="nota">
        {verArquivados ? <Link prefetch={false} href={link({ arquivados: undefined })}>Esconder arquivados</Link> : <Link prefetch={false} href={link({ arquivados: '1' })}>Ver arquivados ({arquivados.length})</Link>}
      </p>
      {verArquivados ? (
        arquivados.length === 0 ? <p className="nota">Nenhum pedido arquivado.</p> : (
          <ul className="cn-lista">
            {arquivados.map((p) => (
              <li key={p.id}><Link className="cn-pedido" href={`/connect/atendimentos/${p.id}`}><span className="cn-pedido-titulo">{p.assunto}</span><span className="nota">{p.produtor} · {dataBR(p.criado_em.slice(0, 10))}</span></Link></li>
            ))}
          </ul>
        )
      ) : null}
    </main>
  );
}
