import { criarClienteServidor } from '@/lib/supabase/server';
import { calcular, PADRAO } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';

export const dynamic = 'force-dynamic';

/**
 * Painel — pendências químicas da carteira. Mesma leitura do protótipo: talhão
 * com V% abaixo da meta, m% acima do tolerado ou fósforo baixo.
 */
export default async function Painel() {
  const sb = await criarClienteServidor();

  const [{ count: nProdutores }, { count: nTalhoes }, { data: analises }] = await Promise.all([
    sb.schema('agro').from('produtores').select('*', { count: 'exact', head: true }),
    sb.schema('agro').from('talhoes').select('*', { count: 'exact', head: true }),
    sb.schema('agro').from('analises')
      .select('id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s, talhao:talhao_id(nome, cultura)')
      .is('arquivado_em', null)
      .order('data_coleta', { ascending: false })
      .limit(50),
  ]);

  const pendencias = (analises ?? []).flatMap((a) => {
    // deno-lint-ignore no-explicit-any
    const t = (a as any).talhao;
    const cult = t ? PADRAO.culturas[t.cultura as string] : undefined;
    const r = calcular(
      { argila: a.argila, pH: a.ph, MO: a.mo, P: a.p, K: a.k, Na: a.na, Ca: a.ca, Mg: a.mg, Al: a.al, HAl: a.h_al, S: a.s },
      PADRAO,
    );
    const V2 = cult?.V2 ?? 60;
    const mMax = cult?.m_max ?? 20;
    if (r.V < V2 - 10) return [{ id: a.id, nome: t?.nome, data: a.data_coleta, txt: `V em ${f(r.V, 0)}% — calagem pendente` }];
    if (r.m > mMax) return [{ id: a.id, nome: t?.nome, data: a.data_coleta, txt: `m em ${f(r.m, 0)}% — alumínio acima do tolerado` }];
    if (r.classeP <= 1) return [{ id: a.id, nome: t?.nome, data: a.data_coleta, txt: 'Fósforo baixo' }];
    return [];
  });

  return (
    <>
      <h1>Painel</h1>
      <p className="nota">O que está aberto na assistência técnica hoje.</p>

      <div style={{ display: 'flex', gap: 12, margin: '18px 0' }}>
        <Metrica rotulo="Produtores" valor={nProdutores ?? 0} />
        <Metrica rotulo="Talhões" valor={nTalhoes ?? 0} />
        <Metrica rotulo="Análises" valor={analises?.length ?? 0} />
        <Metrica rotulo="Pendências" valor={pendencias.length} />
      </div>

      <h2 style={{ fontSize: 16 }}>Talhões que pedem intervenção</h2>
      {pendencias.length === 0 ? (
        <p className="nota">Nada crítico em aberto.</p>
      ) : (
        <ul>
          {pendencias.map((p) => (
            <li key={p.id}>
              <strong>{p.nome ?? 'Talhão'}</strong> — {p.txt} <span className="nota">(coleta de {dataBR(p.data)})</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div style={{ border: '1px solid var(--linha)', borderRadius: 12, padding: '14px 16px', background: '#fff', minWidth: 120 }}>
      <div className="nota" style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontSize: 10 }}>{rotulo}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600 }}>{valor}</div>
    </div>
  );
}
