import Link from 'next/link';
import { Tag } from '@/components/ui';
import { dataBR } from '@/lib/formato';
import {
  ROTULO_CATEGORIA, ROTULO_PRIORIDADE, ROTULO_STATUS, descreverEvento, type PrioridadePedido, type StatusPedido,
} from '@/lib/connect';
import type { ArquivoDoPedido, EventoDoPedido, Mensagem, PedidoResumo } from '@/lib/connect-dados';
import { responderPedido } from '@/app/(connect)/connect/acoes';
import { CampoAnexos } from './campo-anexos';
import { BotaoEnviar } from './botao-enviar';

export type Visao = 'equipe' | 'produtor';

export function SeloStatus({ status, visao }: { status: StatusPedido; visao: Visao }) {
  const r = ROTULO_STATUS[status];
  return <Tag tom={r.tom}>{r[visao]}</Tag>;
}

export function SeloPrioridade({ prioridade }: { prioridade: PrioridadePedido }) {
  if (prioridade === 'normal') return null;
  return <Tag tom={ROTULO_PRIORIDADE[prioridade].tom}>{ROTULO_PRIORIDADE[prioridade].txt}</Tag>;
}

const dataHora = (iso: string) => `${dataBR(iso.slice(0, 10))} às ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;

/** Fotos e PDFs: miniatura clicável para foto (abre em outra aba), nome para PDF. Links assinados que expiram em 1 h. */
export function Anexos({ arquivos }: { arquivos: ArquivoDoPedido[] }) {
  if (arquivos.length === 0) return null;
  return (
    <ul className="cn-anexos">
      {arquivos.map((a) => (
        <li key={a.id}>
          {a.url ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer" title={a.nome}>
              {a.mime.startsWith('image/')
                // eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage; o otimizador do Next não ajuda aqui
                ? <img src={a.url} alt={a.nome} loading="lazy" width={120} height={120} />
                : <span className="cn-anexo-pdf">PDF · {a.nome}</span>}
            </a>
          ) : <span className="nota">{a.nome} (indisponível)</span>}
        </li>
      ))}
    </ul>
  );
}

/** A conversa: o produtor à esquerda, a equipe à direita; nota interna (só a equipe vê) em amarelo. */
export function Conversa({ mensagens, visao, nomes }: { mensagens: Mensagem[]; visao: Visao; nomes: ReadonlyMap<string, string> }) {
  if (mensagens.length === 0) return <p className="nota">Ainda não há mensagens. {visao === 'produtor' ? 'O técnico responde por aqui.' : 'Escreva abaixo para responder.'}</p>;
  return (
    <ol className="cn-conversa" aria-label="Conversa">
      {mensagens.map((m) => {
        const minha = visao === m.autor_tipo;
        const autor = m.autor_tipo === 'equipe' ? (visao === 'equipe' ? (nomes.get(m.autor_id ?? '') ?? 'Equipe') : 'Seu técnico') : 'Produtor';
        return (
          <li key={m.id} className={`cn-msg ${minha ? 'cn-msg-minha' : ''} ${m.interna ? 'cn-msg-interna' : ''}`}>
            <div className="cn-msg-cabeca">
              <b>{minha ? 'Você' : autor}</b>
              {m.interna ? <Tag tom="alerta">nota interna</Tag> : null}
              <time dateTime={m.criado_em}>{dataHora(m.criado_em)}</time>
            </div>
            <p className="cn-msg-corpo">{m.corpo === '(foto)' && m.arquivos.length > 0 ? '' : m.corpo}</p>
            <Anexos arquivos={m.arquivos} />
          </li>
        );
      })}
    </ol>
  );
}

export function LinhaDoTempo({ eventos, visao, nomes }: { eventos: EventoDoPedido[]; visao: Visao; nomes: ReadonlyMap<string, string> }) {
  const linhas = eventos
    // as mensagens já aparecem na conversa
    .filter((e) => e.tipo !== 'mensagem')
    .map((e) => ({ id: e.id, quando: e.criado_em, frase: descreverEvento(e, visao, nomes) }))
    .filter((l): l is { id: string; quando: string; frase: string } => l.frase !== null);
  if (linhas.length === 0) return null;
  return (
    <ol className="cn-tempo" aria-label="Histórico do pedido">
      {linhas.map((l) => (
        <li key={l.id}><span>{l.frase}</span><time dateTime={l.quando}>{dataHora(l.quando)}</time></li>
      ))}
    </ol>
  );
}

/** Caixa de resposta. A equipe ganha a opção de nota interna e aceita PDF. */
export function FormResposta({ pedidoId, visao, rotuloBotao = 'Enviar mensagem' }: { pedidoId: string; visao: Visao; rotuloBotao?: string }) {
  return (
    <form action={responderPedido} className="cn-resposta">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <label className="cn-rotulo">
        {visao === 'produtor' ? 'Sua mensagem' : 'Responder'}
        <textarea name="corpo" rows={4} maxLength={4000} placeholder={visao === 'produtor' ? 'Escreva aqui…' : 'Escreva a resposta ao produtor…'} />
      </label>
      <CampoAnexos rotulo={visao === 'produtor' ? 'Fotos' : 'Fotos ou PDF'} permitirPdf={visao === 'equipe'} />
      {visao === 'equipe' ? (
        <label className="cn-marcar"><input type="checkbox" name="interna" /> Nota interna <span className="nota">(só a equipe vê; o produtor não é avisado)</span></label>
      ) : null}
      <div><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  );
}

/** Uma linha de pedido (lista do produtor). */
export function LinhaDePedido({ p }: { p: PedidoResumo }) {
  return (
    <li>
      <Link className="cn-pedido" href={`/connect/pedidos/${p.id}`}>
        <span className="cn-pedido-titulo">{p.assunto}</span>
        <span className="cn-pedido-meta">
          <SeloStatus status={p.status} visao="produtor" />
          <SeloPrioridade prioridade={p.prioridade} />
          <span className="nota">{ROTULO_CATEGORIA[p.categoria]} · {dataBR(p.criado_em.slice(0, 10))}</span>
        </span>
      </Link>
    </li>
  );
}
