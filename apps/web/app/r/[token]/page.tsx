import type { Metadata } from 'next';
import { gerarRecomendacao, PADRAO } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura, culturaDe, paraAnalise } from '@/lib/culturas';
import { clientePublico } from '@/lib/supabase/publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Resultados da lavoura — AgroTech',
  robots: { index: false, follow: false },
};

interface AnalisePayload {
  id: string; data_coleta: string; profundidade: string | null;
  talhao: string; cultura: string | null; area_ha: number | null; prod_esperada: number | null;
  [k: string]: unknown;
}
interface Payload {
  produtor: string;
  cultura_filtro: string | null;
  rotulo: string | null;
  gerado_em: string;
  analises: AnalisePayload[];
}

export default async function ResultadosPublicos({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = clientePublico();

  let dados: Payload | null = null;
  if (sb) {
    const { data } = await sb.schema('agro').rpc('resultados_por_token', { p_token: token });
    dados = (data as Payload | null) ?? null;
  }

  if (!dados) {
    return (
      <main className="raw">
        <ESTILO />
        <h1>Link inválido ou expirado</h1>
        <p>Peça um novo endereço ao seu técnico.</p>
      </main>
    );
  }

  // agrupa por cultura
  const grupos = new Map<string, AnalisePayload[]>();
  for (const a of dados.analises) {
    const c = a.cultura ?? '__sem';
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c)!.push(a);
  }

  const agora = new Date(dados.gerado_em);
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="raw">
      <ESTILO />
      <header>
        <div className="marca">AGROTECH</div>
        <h1>{dados.produtor}</h1>
        <p className="sub">
          {dados.rotulo ? `${dados.rotulo} · ` : ''}
          {dados.cultura_filtro ? nomeCultura(dados.cultura_filtro) : 'lavoura toda'}
          {' · '}atualizado {hora} de {dataBR(dados.gerado_em.slice(0, 10))}
        </p>
      </header>

      {dados.analises.length === 0 && <p>Ainda não há análises lançadas.</p>}

      {[...grupos.entries()].map(([chave, lista]) => (
        <section key={chave}>
          <h2>{nomeCultura(chave === '__sem' ? null : chave)}</h2>
          {lista.map((a) => {
            const cultura = culturaDe(a.cultura);
            const rec = gerarRecomendacao({
              analise: paraAnalise(a),
              ...(cultura ? { cultura } : {}),
              areaHa: Number(a.area_ha ?? 0),
              ...(a.prod_esperada != null ? { prodEsperadaTalhao: Number(a.prod_esperada) } : {}),
              tabelas: PADRAO,
            });
            const r = rec.calculo;
            const V2 = cultura?.V2 ?? 60;
            const mMax = cultura?.m_max ?? 20;
            const critico = rec.diagnostico.find((d) => d.g === 'crit');

            return (
              <article key={a.id}>
                <div className="titulo">
                  <b>{a.talhao}</b>
                  <span>{dataBR(a.data_coleta)} · {a.profundidade ?? '0-20'} cm · {f(Number(a.area_ha ?? 0), 1)} ha</span>
                </div>

                <div className="numeros">
                  <div className={r.V >= V2 ? 'n bom' : 'n ruim'}>
                    <span>Saturação de bases (V)</span>
                    <b>{f(r.V, 0)}%</b>
                    <em>meta {V2}%</em>
                  </div>
                  <div className={r.m <= mMax ? 'n bom' : 'n ruim'}>
                    <span>Saturação de alumínio (m)</span>
                    <b>{f(r.m, 0)}%</b>
                    <em>limite {mMax}%</em>
                  </div>
                  <div className="n">
                    <span>pH em água</span>
                    <b>{f(Number(a.ph ?? 0), 1)}</b>
                    <em>CTC {f(r.T, 1)}</em>
                  </div>
                </div>

                <ul className="acoes">
                  <li>
                    <b>Calcário:</b> {f(rec.calagem.corrigido, 1)} t/ha
                    {rec.areaHa > 0 ? ` — ${f(rec.totais.calcario_t, 1)} t no talhão` : ''}
                    {' '}({nomeCorretivoCurto(rec.corretivo.corretivo)})
                  </li>
                  {rec.gessagem.precisa && <li><b>Gesso:</b> investigar com análise de 20–40 cm</li>}
                  {rec.adubacao && (
                    <li>
                      <b>Adubação:</b> N {rec.adubacao.N} · P₂O₅ {rec.adubacao.P2O5} · K₂O {rec.adubacao.K2O} kg/ha
                    </li>
                  )}
                  {critico && <li className="alerta"><b>Atenção:</b> {critico.txt}</li>}
                </ul>
              </article>
            );
          })}
        </section>
      ))}

      <footer>
        Gerado pelo AgroTech a partir das análises lançadas pelo seu técnico. Recomendação de partida —
        confirme dose, fonte e época com o responsável técnico antes de aplicar.
      </footer>
    </main>
  );
}

function nomeCorretivoCurto(c: string): string {
  return { calcitico: 'calcítico', magnesiano: 'magnesiano', dolomitico: 'dolomítico' }[c] ?? c;
}

function ESTILO() {
  return (
    <style
      // vitrine "bruta": alto contraste, números grandes, legível no campo
      dangerouslySetInnerHTML={{
        __html: `
        .raw { max-width: 680px; margin: 0 auto; padding: 20px 16px 60px; color: #111; background: #fff; }
        .raw header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 8px; }
        .raw .marca { font: 700 11px/1 var(--mono, monospace); letter-spacing: .28em; color: #0f5c43; }
        .raw h1 { font-size: 26px; margin: 6px 0 2px; }
        .raw .sub { font-size: 12.5px; color: #555; margin: 0; }
        .raw h2 { font-size: 15px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
        .raw article { border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
        .raw .titulo { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; }
        .raw .titulo b { font-size: 15px; }
        .raw .titulo span { font-size: 12px; color: #666; }
        .raw .numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
        .raw .n { border-left: 3px solid #bbb; padding-left: 8px; }
        .raw .n span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
        .raw .n b { display: block; font: 700 24px/1.1 var(--mono, monospace); margin: 3px 0 1px; }
        .raw .n em { font-style: normal; font-size: 11px; color: #888; }
        .raw .n.bom { border-left-color: #1b7355; } .raw .n.bom b { color: #1b7355; }
        .raw .n.ruim { border-left-color: #b4342a; } .raw .n.ruim b { color: #b4342a; }
        .raw .acoes { margin: 6px 0 0; padding-left: 18px; font-size: 13.5px; line-height: 1.7; }
        .raw .acoes .alerta { color: #b4342a; }
        .raw footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11.5px; color: #777; }
        @media (max-width: 520px) { .raw .numeros { grid-template-columns: 1fr; } }
      `,
      }}
    />
  );
}
