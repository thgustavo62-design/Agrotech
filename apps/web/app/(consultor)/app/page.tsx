import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Painel {
  produtores: number;
  talhoes: number;
  area_total: number;
  analises: number;
  laudos_fila: number;
  pendencias: Array<{
    talhao_id: string; analise_id: string | null; nome: string;
    cultura: string | null; data_coleta: string | null; v: number | null; m: number | null;
  }>;
  area_por_cultura: Record<string, number>;
  ultimas_visitas: Array<{ id: string; data: string; fenologia: string | null }>;
}

const VAZIO: Painel = {
  produtores: 0, talhoes: 0, area_total: 0, analises: 0, laudos_fila: 0,
  pendencias: [], area_por_cultura: {}, ultimas_visitas: [],
};

export default async function PaginaPainel() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').rpc('painel_consultor');
  const p = (data as Painel | null) ?? VAZIO;

  const culturas = Object.entries(p.area_por_cultura).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <CabecalhoVista
        olho="Fila de trabalho"
        titulo="Painel"
        descricao="O que pede a sua atenção hoje na assistência técnica."
        acoes={
          <>
            <Link className="btn verde" href="/app/analises/nova">Lançar análise</Link>
            <Link className="btn sec" href="/app/laudos">Enviar laudo (PDF)</Link>
          </>
        }
      />

      <Cartao olho="Pendências químicas" titulo="Talhões que pedem intervenção">
        {p.pendencias.length === 0 ? (
          <Vazio titulo="Nada crítico em aberto">
            Nenhum talhão com saturação por bases abaixo de 45% ou alumínio acima de 20% na última análise.
          </Vazio>
        ) : (
          <div className="lista">
            {p.pendencias.map((pd) => (
              <div className="item" key={pd.talhao_id}>
                <div className="cresce">
                  <h3>{pd.nome}</h3>
                  <small className="mono">
                    {nomeCultura(pd.cultura)} · V {pd.v != null ? `${f(pd.v, 0)}%` : '—'} · m {pd.m != null ? `${f(pd.m, 0)}%` : '—'}
                    {pd.data_coleta ? ` · coleta de ${dataBR(pd.data_coleta)}` : ''}
                  </small>
                </div>
                <Tag tom="ruim">precisa correção</Tag>
                {pd.analise_id ? (
                  <Link className="btn sec mini" href={`/app/analises/${pd.analise_id}`}>Abrir</Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Grade cols={4}>
        <Metrica rotulo="Laudos na fila" valor={p.laudos_fila} cor={p.laudos_fila ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Talhões" valor={p.talhoes} detalhe={`${f(p.area_total, 1)} ha`} />
        <Metrica rotulo="Análises" valor={p.analises} />
        <Metrica rotulo="Produtores" valor={p.produtores} />
      </Grade>

      {culturas.length > 0 && (
        <Cartao olho="Composição" titulo="Área por cultura">
          <div className="lista">
            {culturas.map(([c, area]) => {
              const pct = p.area_total > 0 ? (100 * area) / p.area_total : 0;
              return (
                <div className="item" key={c}>
                  <div className="cresce">
                    <h3>{nomeCultura(c)}</h3>
                    <div style={{ height: 6, background: 'var(--linha)', borderRadius: 99, marginTop: 6 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--folha)', borderRadius: 99 }} />
                    </div>
                  </div>
                  <span className="mono nota">{f(area, 1)} ha · {f(pct, 0)}%</span>
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

      <Cartao olho="Caderno de campo" titulo="Últimas visitas">
        {p.ultimas_visitas.length === 0 ? (
          <Vazio titulo="Nenhuma visita registrada">Comece pela aba Monitoramento.</Vazio>
        ) : (
          <div className="lista">
            {p.ultimas_visitas.map((v) => (
              <div className="item" key={v.id}>
                <div className="cresce">
                  <h3>{dataBR(v.data)}</h3>
                  <small>{v.fenologia ?? '—'}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
