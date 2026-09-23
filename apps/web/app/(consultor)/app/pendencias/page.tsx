import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Painel {
  pendencias: Array<{
    talhao_id: string; analise_id: string | null; nome: string;
    cultura: string | null; data_coleta: string | null; v: number | null; m: number | null;
  }>;
}

/** Recorte do painel: só a fila de correção, sem o resto do dashboard. */
export default async function Pendencias() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').rpc('painel_consultor');
  const pendencias = ((data as Painel | null)?.pendencias) ?? [];

  return (
    <>
      <CabecalhoVista
        olho="Fila de trabalho"
        titulo="Pendências"
        descricao="Todos os talhões com saturação por bases abaixo de 45% ou alumínio acima de 20% na última análise."
      />
      <Cartao olho="Correção" titulo={`${pendencias.length} talhão(ões) pedindo atenção`}>
        {pendencias.length === 0 ? (
          <Vazio titulo="Nada crítico em aberto" />
        ) : (
          <div className="lista">
            {pendencias.map((pd) => (
              <div className="item" key={pd.talhao_id}>
                <div className="cresce">
                  <h3>{pd.nome}</h3>
                  <small className="mono">
                    {nomeCultura(pd.cultura)} · V {pd.v != null ? `${f(pd.v, 0)}%` : '—'} · m {pd.m != null ? `${f(pd.m, 0)}%` : '—'}
                    {pd.data_coleta ? ` · coleta de ${dataBR(pd.data_coleta)}` : ''}
                  </small>
                </div>
                <Tag tom="ruim">precisa correção</Tag>
                <Link className="btn sec mini" href={`/app/talhoes/${pd.talhao_id}`}>abrir talhão</Link>
                {pd.analise_id ? <Link className="btn sec mini" href={`/app/analises/${pd.analise_id}`}>análise</Link> : null}
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
