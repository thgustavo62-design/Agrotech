import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { ROTULO_TIPO_NOTIFICACAO } from '@/lib/notificacoes';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { marcarNotificacaoLida, marcarTodasLidas } from './acoes';

export const dynamic = 'force-dynamic';

export default async function NotificacoesProdutor() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('notificacoes')
    .select('id, tipo, titulo, corpo, link, lida_em, criado_em')
    .order('criado_em', { ascending: false })
    .limit(100);

  const notificacoes = (data ?? []) as Array<{
    id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; lida_em: string | null; criado_em: string;
  }>;
  const naoLidas = notificacoes.filter((n) => !n.lida_em).length;

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo="Notificações"
        descricao={naoLidas > 0 ? `${naoLidas} não lida(s).` : 'Tudo em dia.'}
        tags={['Avisos', 'Novidades', 'Acompanhamento']}
        acoes={naoLidas > 0 ? (
          <form action={marcarTodasLidas}>
            <button className="btn sec" type="submit">Marcar todas como lidas</button>
          </form>
        ) : undefined}
      />

      <Cartao olho={`${notificacoes.length} no total`} titulo="Recentes">
        {notificacoes.length === 0 ? (
          <Vazio titulo="Nenhuma notificação ainda" />
        ) : (
          <div className="lista">
            {notificacoes.map((n) => (
              <div className="item" key={n.id}>
                <div className="cresce">
                  <h3>{n.titulo}</h3>
                  <small>
                    <Tag tom="cinza">{ROTULO_TIPO_NOTIFICACAO[n.tipo] ?? n.tipo}</Tag>{' '}
                    {dataBR(n.criado_em.slice(0, 10))} às {n.criado_em.slice(11, 16)}
                  </small>
                  {n.corpo ? <p className="nota" style={{ margin: '4px 0 0' }}>{n.corpo}</p> : null}
                </div>
                {!n.lida_em && (
                  <form action={marcarNotificacaoLida}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="btn sec mini" type="submit">marcar lida</button>
                  </form>
                )}
                {n.link ? <Link className="btn sec mini" href={n.link}>abrir</Link> : null}
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
