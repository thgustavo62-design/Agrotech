import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { calcular, PADRAO } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

type LinhaAnalise = {
  id: string;
  data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null;
  k: number | null; na: number | null; ca: number | null; mg: number | null;
  al: number | null; h_al: number | null; s: number | null;
  talhao: { nome: string | null; cultura: string | null } | null;
};

export default async function Painel() {
  const sb = await criarClienteServidor();

  const [{ count: nProdutores }, { count: nTalhoes }, { data: analisesRaw }, { data: visitasRaw }] =
    await Promise.all([
      sb.schema('agro').from('produtores').select('*', { count: 'exact', head: true }),
      sb.schema('agro').from('talhoes').select('*', { count: 'exact', head: true }),
      sb.schema('agro').from('analises')
        .select('id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s, talhao:talhao_id(nome, cultura)')
        .is('arquivado_em', null)
        .order('data_coleta', { ascending: false })
        .limit(80),
      sb.schema('agro').from('visitas')
        .select('id, data, fenologia, talhao:talhao_id(nome)')
        .order('data', { ascending: false })
        .limit(5),
    ]);

  const analises = (analisesRaw ?? []) as unknown as LinhaAnalise[];

  type Pendencia = { id: string; nome: string; data: string; txt: string; tom: 'ruim' | 'alerta' };

  const pendencias: Pendencia[] = analises.flatMap((a): Pendencia[] => {
    const cult = a.talhao?.cultura ? PADRAO.culturas[a.talhao.cultura] : undefined;
    const r = calcular(
      { argila: a.argila, pH: a.ph, MO: a.mo, P: a.p, K: a.k, Na: a.na, Ca: a.ca, Mg: a.mg, Al: a.al, HAl: a.h_al, S: a.s },
      PADRAO,
    );
    const V2 = cult?.V2 ?? 60;
    const mMax = cult?.m_max ?? 20;
    const base = { id: a.id, nome: a.talhao?.nome ?? 'Talhão', data: a.data_coleta };
    if (r.V < V2 - 10) return [{ ...base, txt: `V em ${f(r.V, 0)}% — calagem pendente`, tom: 'ruim' }];
    if (r.m > mMax) return [{ ...base, txt: `m em ${f(r.m, 0)}% — alumínio acima do tolerado`, tom: 'ruim' }];
    if (r.classeP <= 1) return [{ ...base, txt: 'Fósforo baixo', tom: 'alerta' }];
    return [];
  });

  const visitas = (visitasRaw ?? []) as unknown as Array<{
    id: string; data: string; fenologia: string | null; talhao: { nome: string | null } | null;
  }>;

  return (
    <>
      <CabecalhoVista
        olho="Visão geral da carteira"
        titulo="Painel"
        descricao="O que está aberto na assistência técnica hoje."
        acoes={
          <>
            <Link className="btn verde" href="/app/analises/nova">Lançar análise</Link>
            <Link className="btn sec" href="/app/laudos">Enviar laudo (PDF)</Link>
          </>
        }
      />

      <Grade cols={4}>
        <Metrica rotulo="Produtores" valor={nProdutores ?? 0} />
        <Metrica rotulo="Talhões" valor={nTalhoes ?? 0} />
        <Metrica rotulo="Análises" valor={analises.length} />
        <Metrica rotulo="Pendências" valor={pendencias.length} cor={pendencias.length ? 'var(--c-mb)' : undefined} />
      </Grade>

      <Cartao olho="Pendências químicas" titulo="Talhões que pedem intervenção" style={{ marginTop: 14 }}>
        {pendencias.length === 0 ? (
          <Vazio titulo="Nada crítico em aberto">
            Todas as análises lançadas estão dentro das faixas das respectivas culturas.
          </Vazio>
        ) : (
          <div className="lista">
            {pendencias.map((p) => (
              <div className="item" key={p.id}>
                <div className="cresce">
                  <h3>{p.nome}</h3>
                  <small>coleta de {dataBR(p.data)}</small>
                </div>
                <Tag tom={p.tom}>{p.txt}</Tag>
                <Link className="btn sec mini" href={`/app/analises/${p.id}`}>Abrir</Link>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao olho="Caderno de campo" titulo="Últimas visitas">
        {visitas.length === 0 ? (
          <Vazio titulo="Nenhuma visita registrada">Comece pela aba Monitoramento.</Vazio>
        ) : (
          <div className="lista">
            {visitas.map((v) => (
              <div className="item" key={v.id}>
                <div className="cresce">
                  <h3>{v.talhao?.nome ?? 'Talhão'} — {dataBR(v.data)}</h3>
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
