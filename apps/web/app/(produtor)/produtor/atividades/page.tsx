import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';

export const dynamic = 'force-dynamic';

type Visita = {
  id: string;
  data: string;
  fenologia: string | null;
  condicao: string | null;
  recomendacao: string | null;
  proxima_visita: string | null;
  talhao: { nome: string } | null;
  ocorrencias: Array<{ alvo: string; valor: string | null; acima_nivel: boolean }>;
  fotos: Array<{ id: string; storage_path: string; legenda: string | null; lat: number | null; lng: number | null }>;
};

const TOM_CONDICAO: Record<string, 'ok' | 'alerta' | 'ruim'> = { Boa: 'ok', Regular: 'alerta', Preocupante: 'ruim' };

/** Linha do tempo das visitas do técnico ao produtor. As observações internas do técnico
 *  (`visitas.observacoes`) não são exibidas aqui — só o que é destinado ao produtor. */
export default async function AtividadesProdutor() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('visitas')
    .select(
      'id, data, fenologia, condicao, recomendacao, proxima_visita, talhao:talhao_id(nome), ' +
      'ocorrencias:visita_ocorrencias(alvo, valor, acima_nivel), fotos:visita_fotos(id, storage_path, legenda, lat, lng)',
    )
    .order('data', { ascending: false });
  const visitas = (data ?? []) as unknown as Visita[];

  // URLs assinadas: o bucket é privado e a policy só libera as fotos das visitas deste produtor
  const caminhos = visitas.flatMap((v) => v.fotos.map((f) => f.storage_path));
  const urls = new Map<string, string | null>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await sb.storage.from('visitas').createSignedUrls(caminhos, 3600);
    for (const a of assinadas ?? []) urls.set(a.path ?? '', a.signedUrl);
  }

  const proxima = visitas.map((v) => v.proxima_visita).filter((d): d is string => !!d).sort().pop() ?? null;

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Acompanhamento"
        titulo="Atividades"
        tags={['Visitas', 'Fotos', 'Recomendações']}
        descricao="Linha do tempo das visitas do seu técnico: o que ele viu no campo, o que recomendou e as fotos."
      />

      {proxima && new Date(proxima) >= new Date(new Date().toDateString()) ? (
        <div className="aviso" style={{ marginBottom: 14 }}>Próxima visita prevista para {dataBR(proxima)}.</div>
      ) : null}

      {visitas.length === 0 ? (
        <Vazio titulo="Nenhuma visita registrada ainda">
          Quando o seu técnico registrar uma visita, ela aparece aqui com as fotos.
        </Vazio>
      ) : (
        visitas.map((v) => {
          const acima = v.ocorrencias.filter((o) => o.acima_nivel);
          return (
            <Cartao key={v.id} olho={dataBR(v.data)} titulo={v.talhao?.nome ?? 'Talhão'} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {v.condicao ? <Tag tom={TOM_CONDICAO[v.condicao] ?? 'cinza'}>condição {v.condicao.toLowerCase()}</Tag> : null}
                {v.fenologia ? <Tag>{v.fenologia}</Tag> : null}
                {acima.length > 0 ? <Tag tom="ruim">{acima.length} acima do nível de controle</Tag> : null}
              </div>

              {v.ocorrencias.length > 0 ? (
                <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13.5 }}>
                  {v.ocorrencias.map((o, i) => (
                    <li key={i}>{o.alvo}{o.valor ? ` — ${o.valor}` : ''}{o.acima_nivel ? ' (acima do nível)' : ''}</li>
                  ))}
                </ul>
              ) : null}

              {v.recomendacao ? (
                <p style={{ margin: '0 0 8px', fontSize: 13.5 }}><b>Recomendação do técnico:</b> {v.recomendacao}</p>
              ) : null}

              {v.fotos.length > 0 ? (
                <div className="grade g4">
                  {v.fotos.map((ft) => {
                    const url = urls.get(ft.storage_path);
                    return url ? (
                      <figure key={ft.id} style={{ margin: 0 }}>
                        {/* URL assinada do Storage, host desconhecido em build-time — next/image exigiria remotePatterns */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={ft.legenda ?? 'foto da visita'} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                        {ft.legenda ? <figcaption className="nota">{ft.legenda}</figcaption> : null}
                      </figure>
                    ) : null;
                  })}
                </div>
              ) : null}
            </Cartao>
          );
        })
      )}
    </>
  );
}
