import Link from 'next/link';
import { AtivarAvisos } from '@/components/ativar-avisos';
import { chavePublicaDeAvisos } from '@/lib/push';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { ROTULO_TIPO_NOTIFICACAO } from '@/lib/notificacoes';
import { Tag } from '@/components/ui';
import { marcarAvisoLido, marcarTodosAvisos } from '../acoes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Avisos · AgroTech Connect' };

/** Avisos do Connect: só os de atendimento (os outros ficam no sino do site de origem). */
export default async function AvisosConnect() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('notificacoes')
    .select('id, tipo, titulo, corpo, link, lida_em, criado_em')
    .like('tipo', 'atendimento_%').order('criado_em', { ascending: false }).limit(100);
  const avisos = (data ?? []) as Array<{ id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; lida_em: string | null; criado_em: string }>;
  const naoLidos = avisos.filter((a) => !a.lida_em).length;

  return (
    <main className="cn-principal cn-estreito">
      <div className="cn-bloco-cabeca">
        <h1>Avisos</h1>
        {naoLidos > 0 ? <form action={marcarTodosAvisos}><button className="btn sec" type="submit">Marcar todos como lidos</button></form> : null}
      </div>
      <AtivarAvisos chavePublica={chavePublicaDeAvisos()} />
      <p className="nota">{naoLidos > 0 ? `${naoLidos} não lido(s).` : 'Tudo em dia.'}</p>

      {avisos.length === 0 ? (
        <div className="vazio"><b>Nenhum aviso ainda</b><p>Quando o atendimento mudar, você é avisado aqui.</p></div>
      ) : (
        <ul className="cn-lista">
          {avisos.map((a) => (
            <li key={a.id} className={`cn-aviso ${a.lida_em ? '' : 'cn-aviso-novo'}`}>
              <div className="cresce">
                <b>{a.titulo}</b>
                <small><Tag tom="cinza">{ROTULO_TIPO_NOTIFICACAO[a.tipo] ?? a.tipo}</Tag> {dataBR(a.criado_em.slice(0, 10))} às {a.criado_em.slice(11, 16)}</small>
                {a.corpo ? <p className="nota">{a.corpo}</p> : null}
              </div>
              <div className="cn-aviso-acoes">
                {a.link ? <Link className="btn sec mini" href={a.link}>abrir</Link> : null}
                {!a.lida_em ? <form action={marcarAvisoLido}><input type="hidden" name="id" value={a.id} /><button className="btn sec mini" type="submit">marcar lido</button></form> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
