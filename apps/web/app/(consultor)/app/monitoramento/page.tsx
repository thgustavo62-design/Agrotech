import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero } from '@/components/banner-hero';
import { IconeMonitoramento } from '@/components/icones';

export const dynamic = 'force-dynamic';

export default async function Monitoramento() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('visitas')
    .select('id, data, fenologia, condicao, talhao_id, talhao:talhao_id(nome), ocorrencias:visita_ocorrencias(acima_nivel)')
    .order('data', { ascending: false });

  const visitas = data ?? [];
  const comAlerta = visitas.filter((v) => ((v.ocorrencias as Array<{ acima_nivel: boolean }>)?.some((o) => o.acima_nivel))).length;

  return (
    <>
      <BannerHero
        olho="Caderno de campo"
        titulo="Monitoramento"
        descricao="Visita com fenologia, amostragem fitossanitária e comparação com o nível de controle. Registrar uma visita nova é feito de dentro do talhão."
        tags={['Campo', 'Fitossanidade', 'Controle']}
      />

      {visitas.length > 0 && (
        <Grade cols={2} style={{ marginBottom: 14 }}>
          <Metrica rotulo="Visitas registradas" valor={visitas.length} icone={IconeMonitoramento} />
          <Metrica rotulo="Com alvo acima do nível" valor={comAlerta} cor={comAlerta ? 'var(--c-mb)' : undefined} />
        </Grade>
      )}
      {visitas.length === 0 ? (
        <Vazio titulo="Caderno vazio">Cada visita vira histórico do talhão e entra no laudo.</Vazio>
      ) : (
        <div className="lista">
          {visitas.map((v) => {
            // deno-lint-ignore no-explicit-any
            const acima = ((v as any).ocorrencias ?? []).filter((o: any) => o.acima_nivel).length;
            return (
              <div className="item" key={v.id as string}>
                <div className="cresce">
                  {/* deno-lint-ignore no-explicit-any */}
                  <h3>{(v as any).talhao?.nome ?? 'Talhão'} — {dataBR(String(v.data))}</h3>
                  <small>{(v.fenologia as string) ?? '—'} · condição {(v.condicao as string) ?? '—'}</small>
                </div>
                {acima > 0 ? <Tag tom="ruim">{acima} acima do nível</Tag> : <Tag>Sob controle</Tag>}
                {v.talhao_id ? <Link className="btn sec mini" href={`/app/talhoes/${v.talhao_id}`}>abrir talhão</Link> : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
