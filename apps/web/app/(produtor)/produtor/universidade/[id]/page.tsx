import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag } from '@/components/ui';
import { ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO, dominioDoLink, type Conteudo } from '@/lib/academy';
import { concluirConteudo } from '../acoes';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConteudoDoProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const sb = await criarClienteServidor();
  // a RLS decide: se não for publicado e para este produtor, o conteúdo simplesmente não existe para ele
  const { data } = await sb.schema('agro').from('academy_conteudos').select('*').eq('id', id).eq('status', 'publicado').maybeSingle();
  if (!data) notFound();
  const c = data as unknown as Conteudo;

  const { data: ind } = await sb.schema('agro').from('academy_indicacoes')
    .select('id, mensagem, criado_em, aberto_em, concluido_em').eq('conteudo_id', id).maybeSingle();

  // abrir a página conta como "abriu" para o agrônomo acompanhar (o banco grava a hora; só vale uma vez)
  if (ind && !ind.aberto_em) {
    await sb.schema('agro').from('academy_indicacoes').update({ aberto_em: new Date().toISOString() }).eq('id', ind.id);
  }

  const assinada = c.arquivo_path ? await sb.storage.from('academy').createSignedUrl(c.arquivo_path, 3600) : null;
  const dominio = dominioDoLink(c.url);

  return (
    <>
      <CabecalhoVista
        olho={`Universidade · ${ROTULO_TIPO[c.tipo]}`}
        titulo={c.titulo}
        descricao={c.descricao ?? undefined}
        acoes={<Link className="btn sec" href="/produtor/universidade">Voltar</Link>}
      />

      <Cartao>
        <div className="conteudo-meta">
          {c.tema ? <span>{ROTULO_TEMA[c.tema]}</span> : null}
          {c.cultura ? <span>{c.cultura}</span> : null}
          <span>{ROTULO_NIVEL[c.nivel]}</span>
          {c.duracao_min ? <span>{c.duracao_min} min</span> : null}
          {c.fonte ? <span>Fonte: {c.fonte}</span> : null}
          {c.revisado_em ? <span>Revisado em {dataBR(c.revisado_em)}</span> : null}
        </div>

        {ind?.mensagem ? (
          <div className="aviso" style={{ marginBottom: 14 }}>
            <b>Recado do seu agrônomo:</b> “{ind.mensagem}”
          </div>
        ) : null}

        {c.tipo === 'video' && c.url ? (
          <p>
            <a className="btn verde" href={c.url} target="_blank" rel="noopener noreferrer">Assistir ao vídeo</a>{' '}
            <small className="nota">abre em outra aba{dominio ? ` (${dominio})` : ''}</small>
          </p>
        ) : null}

        {c.tipo === 'artigo' && c.corpo ? <div className="conteudo-corpo">{c.corpo}</div> : null}

        {c.tipo === 'material' ? (
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {assinada?.data?.signedUrl ? (
              <a className="btn verde" href={assinada.data.signedUrl} target="_blank" rel="noopener noreferrer">Abrir o material</a>
            ) : null}
            {c.url ? (
              <a className="btn sec" href={c.url} target="_blank" rel="noopener noreferrer">Abrir o link{dominio ? ` (${dominio})` : ''}</a>
            ) : null}
          </p>
        ) : null}

        {ind ? (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--linha)' }}>
            {ind.concluido_em ? (
              <Tag tom="ok">Concluído em {dataBR(ind.concluido_em)}</Tag>
            ) : (
              <form action={concluirConteudo}>
                <input type="hidden" name="conteudo_id" value={c.id} />
                <button className="btn verde" type="submit">Marcar como concluído</button>{' '}
                <small className="nota">O seu agrônomo vê que você terminou.</small>
              </form>
            )}
          </div>
        ) : null}
      </Cartao>
    </>
  );
}
