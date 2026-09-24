import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DocumentosProdutor() {
  const sb = await criarClienteServidor();

  const { data } = await sb
    .schema('agro')
    .from('documentos')
    .select('id, nome_arquivo, laboratorio, status, storage_path, criado_em')
    .order('criado_em', { ascending: false });

  const documentos = (data ?? []) as Array<{
    id: string; nome_arquivo: string | null; laboratorio: string | null; status: string; storage_path: string; criado_em: string;
  }>;

  const { data: assinadas } = documentos.length
    ? await sb.storage.from('laudos').createSignedUrls(documentos.map((d) => d.storage_path), 3600)
    : { data: [] as Array<{ path: string | null; signedUrl: string }> };
  const urlPdf = new Map<string, string | null>((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));

  return (
    <>
      <CabecalhoVista
        olho="Sua lavoura"
        titulo="Documentos"
        descricao="Os laudos em PDF que o seu técnico enviou."
      />

      <Cartao olho={`${documentos.length} documento(s)`} titulo="Laudos recebidos">
        {documentos.length === 0 ? (
          <Vazio titulo="Nenhum laudo enviado ainda" />
        ) : (
          <div className="lista">
            {documentos.map((d) => {
              const s = ROTULO_STATUS_DOCUMENTO[d.status] ?? { txt: d.status, tom: 'cinza' as const };
              const url = urlPdf.get(d.storage_path);
              return (
                <div className="item" key={d.id}>
                  <div className="cresce">
                    <h3>{d.nome_arquivo ?? 'laudo.pdf'}</h3>
                    <small>{d.laboratorio ?? 'laboratório não identificado'} · {dataBR(d.criado_em.slice(0, 10))}</small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                  {url ? <a className="btn sec mini" href={url} target="_blank" rel="noreferrer">abrir PDF</a> : null}
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
