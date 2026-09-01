import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ROTULO_STATUS: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  recebido: { txt: 'na fila', tom: 'cinza' },
  extraindo: { txt: 'extraindo', tom: 'cinza' },
  extraido: { txt: 'extraído', tom: 'cinza' },
  revisao: { txt: 'aguardando conferência', tom: 'alerta' },
  confirmado: { txt: 'confirmado', tom: 'ok' },
  erro: { txt: 'erro', tom: 'ruim' },
};

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
        acoes={<button className="btn verde" disabled>Enviar PDF (Fase 3)</button>}
      />

      <Cartao olho="Como funciona" titulo="Pipeline de ingestão">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>upload → <code>documentos</code> (dedup por hash)</li>
          <li>Edge Function <code>processar-laudo</code>: extrai texto, detecta o laboratório, aplica o perfil de parsing</li>
          <li>confiança baixa → normalização por LLM (teto 0,65, nunca pula a conferência)</li>
          <li>tela de conferência lado a lado → agrônomo confirma → vira <code>análise</code> → motor roda</li>
        </ol>
      </Cartao>

      {docs.length === 0 ? (
        <Vazio titulo="Nenhum laudo enviado">O upload de PDF entra na Fase 3.</Vazio>
      ) : (
        <div className="lista">
          {docs.map((d) => {
            const s = ROTULO_STATUS[d.status as string] ?? { txt: d.status as string, tom: 'cinza' as const };
            return (
              <div className="item" key={d.id as string}>
                <div className="cresce">
                  <h3>{(d.nome_arquivo as string) ?? 'laudo.pdf'}</h3>
                  <small>
                    {(d.laboratorio as string) ?? 'laboratório não detectado'} · {dataBR(String(d.criado_em).slice(0, 10))}
                    {d.confianca_media ? ` · confiança ${d.confianca_media}` : ''}
                  </small>
                </div>
                <Tag tom={s.tom}>{s.txt}</Tag>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
