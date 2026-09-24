import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Laudos() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('documentos')
    .select('id, nome_arquivo, laboratorio, status, confianca_media, criado_em')
    .order('criado_em', { ascending: false });

  const docs = data ?? [];

  return (
    <>
      <CabecalhoVista
        olho="Ingestão"
        titulo="Laudos em PDF"
        descricao="Envie o PDF do laboratório. O sistema extrai os parâmetros e devolve para conferência antes de virar análise."
        acoes={<Link className="btn verde" href="/app/laudos/novo">Enviar PDF</Link>}
      />

      <Cartao olho="Como funciona" titulo="Pipeline de ingestão">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>upload → <code>documentos</code> (dedup por hash)</li>
          <li>extrai texto, detecta o laboratório, aplica o perfil de parsing (<code>@agrotech/agro-core/parsers</code>)</li>
          <li>confiança baixa → destaque na conferência (teto 0,65 quando vier de LLM, nunca pula a tela)</li>
          <li>tela de conferência lado a lado → agrônomo confirma → vira <code>análise</code> → motor roda</li>
        </ol>
      </Cartao>

      {docs.length === 0 ? (
        <Vazio titulo="Nenhum laudo enviado">
          <Link href="/app/laudos/novo">Enviar o primeiro PDF.</Link>
        </Vazio>
      ) : (
        <div className="lista">
          {docs.map((d) => {
            const s = ROTULO_STATUS_DOCUMENTO[d.status as string] ?? { txt: d.status as string, tom: 'cinza' as const };
            const acionavel = d.status === 'revisao' || d.status === 'erro' || d.status === 'confirmado';
            return (
              <div className="item" key={d.id as string}>
                <div className="cresce">
                  <h3>{(d.nome_arquivo as string) ?? 'laudo.pdf'}</h3>
                  <small>
                    {(d.laboratorio as string) ?? 'laboratório não detectado'} · {dataBR(String(d.criado_em).slice(0, 10))}
                    {d.confianca_media ? ` · confiança ${Math.round(Number(d.confianca_media) * 100)}%` : ''}
                  </small>
                </div>
                <Tag tom={s.tom}>{s.txt}</Tag>
                {acionavel ? (
                  <Link className="btn sec mini" href={`/app/laudos/${d.id}`}>
                    {d.status === 'confirmado' ? 'ver' : 'conferir'}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
