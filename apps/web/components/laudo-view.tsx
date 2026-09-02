import { nomeCorretivo, type Analise, type Recomendacao } from '@agrotech/agro-core';
import { f } from '@/lib/formato';

export interface ContextoLaudo {
  produtor: string;
  propriedade: string;
  municipio: string;
  talhao: string;
  variedade: string;
  culturaNome: string;
  culturaUn: string;
  culturaParc: string[];
  culturaObs: string;
  dataColeta: string;
  profundidade: string;
  laboratorio: string;
  consultor: { nome: string; crea: string; fone: string; empresa: string };
  emitidaEm: string;
}

/**
 * Laudo A4. Renderiza a partir de uma Recomendação JÁ CALCULADA (persistida em
 * agro.recomendacoes com motor_versao + snapshot). Nada é recalculado aqui, para
 * o laudo do produtor bater sempre com o que o consultor emitiu.
 */
export function LaudoView({
  rec, analise: a, ctx,
}: {
  rec: Recomendacao;
  analise: Analise;
  ctx: ContextoLaudo;
}) {
  const r = rec.calculo;
  const cal = rec.calagem;
  const ad = rec.adubacao;
  const val = (v: unknown) => (v == null || v === '' ? 0 : Number(String(v).replace(',', '.')));

  return (
    <div className="folha-a4">
      <div className="cabecalho">
        <div>
          <h2 style={{ border: 0, padding: 0, margin: 0, fontSize: 22 }}>Laudo de recomendação agronômica</h2>
          <div className="nota">{ctx.consultor.empresa} · emitido em {ctx.emitidaEm} · motor {rec.motor_versao}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <b>{ctx.consultor.nome || '—'}</b><br />
          {ctx.consultor.crea ? `CREA ${ctx.consultor.crea}` : ''}<br />
          {ctx.consultor.fone}
        </div>
      </div>

      <h2>1. Identificação</h2>
      <table>
        <tbody>
          <tr><td><b>Produtor</b></td><td>{ctx.produtor || '—'}</td><td><b>Propriedade</b></td><td>{ctx.propriedade || '—'}</td></tr>
          <tr><td><b>Município</b></td><td>{ctx.municipio || '—'}</td><td><b>Talhão</b></td><td>{ctx.talhao || '—'} · {f(rec.areaHa, 1)} ha</td></tr>
          <tr><td><b>Cultura</b></td><td>{ctx.culturaNome || '—'}</td><td><b>Variedade</b></td><td>{ctx.variedade || '—'}</td></tr>
          <tr><td><b>Coleta</b></td><td>{ctx.dataColeta} · {ctx.profundidade} cm</td><td><b>Laboratório</b></td><td>{ctx.laboratorio || '—'}</td></tr>
        </tbody>
      </table>

      <h2>2. Resultado da análise</h2>
      <table>
        <tbody>
          <tr><th>pH</th><th className="num">M.O.</th><th className="num">P</th><th className="num">K</th><th className="num">Ca</th><th className="num">Mg</th><th className="num">Al</th><th className="num">H+Al</th></tr>
          <tr>
            <td className="num">{f(val(a.pH), 1)}</td><td className="num">{f(val(a.MO), 1)}</td>
            <td className="num">{f(val(a.P), 1)}</td><td className="num">{f(val(a.K), 0)}</td>
            <td className="num">{f(val(a.Ca), 2)}</td><td className="num">{f(val(a.Mg), 2)}</td>
            <td className="num">{f(val(a.Al), 2)}</td><td className="num">{f(val(a.HAl), 2)}</td>
          </tr>
          <tr><th>SB</th><th className="num">CTC (t)</th><th className="num">CTC (T)</th><th className="num">V%</th><th className="num">m%</th><th className="num">Ca/Mg</th><th className="num">Argila</th><th className="num">S</th></tr>
          <tr>
            <td className="num">{f(r.SB, 2)}</td><td className="num">{f(r.t, 2)}</td><td className="num">{f(r.T, 2)}</td>
            <td className="num">{f(r.V, 1)}</td><td className="num">{f(r.m, 1)}</td><td className="num">{f(r.CaMg, 1)}</td>
            <td className="num">{f(val(a.argila), 0)}%</td><td className="num">{f(val(a.S), 1)}</td>
          </tr>
          <tr><th>B</th><th className="num">Zn</th><th className="num">Cu</th><th className="num">Mn</th><th className="num">Fe</th><th colSpan={3} /></tr>
          <tr>
            <td className="num">{f(val(a.B), 2)}</td><td className="num">{f(val(a.Zn), 1)}</td><td className="num">{f(val(a.Cu), 1)}</td>
            <td className="num">{f(val(a.Mn), 1)}</td><td className="num">{f(val(a.Fe), 1)}</td><td colSpan={3} />
          </tr>
        </tbody>
      </table>

      <h2>3. Diagnóstico</h2>
      <ul style={{ fontSize: 13.5 }}>
        {rec.diagnostico.map((x, i) => <li key={i} style={{ marginBottom: 5 }}>{x.txt}</li>)}
      </ul>

      <h2>4. Correção do solo</h2>
      <p style={{ fontSize: 13.5 }}>
        Elevação da saturação por bases para {cal.V2}%, com {nomeCorretivo(rec.corretivo.corretivo).toLowerCase()} de
        PRNT {val(a.prnt) || 85}% incorporado a 0–{a.incorp ?? 20} cm. {rec.corretivo.motivo}
      </p>
      <table>
        <tbody>
          <tr><td><b>Calcário</b></td><td className="num">{f(cal.corrigido, 2)} t/ha</td><td className="num">{f(rec.totais.calcario_t, 1)} t no talhão</td></tr>
          {rec.gessagem.precisa && (
            <tr><td><b>Gesso agrícola</b></td><td className="num">investigar</td><td className="num">exige análise de 20–40 cm</td></tr>
          )}
        </tbody>
      </table>

      {ad && (
        <>
          <h2>5. Adubação — produtividade esperada de {f(rec.produtividade, 1)} {ctx.culturaUn}</h2>
          <table>
            <tbody>
              <tr><th>Nutriente</th><th className="num">kg/ha</th><th className="num">Total ({f(rec.areaHa, 1)} ha)</th></tr>
              <tr><td>N</td><td className="num">{ad.N}</td><td className="num">{f(rec.totais.N_kg, 0)} kg</td></tr>
              <tr><td>P₂O₅</td><td className="num">{ad.P2O5}</td><td className="num">{f(rec.totais.P2O5_kg, 0)} kg</td></tr>
              <tr><td>K₂O</td><td className="num">{ad.K2O}</td><td className="num">{f(rec.totais.K2O_kg, 0)} kg</td></tr>
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>Fontes sugeridas</h3>
          <ul style={{ fontSize: 13 }}>
            {rec.fontes.map((ft, i) => <li key={i}>{ft.nome} — {f(ft.dose, 0)} kg/ha ({ft.obs})</li>)}
          </ul>
          {ctx.culturaParc.length > 0 && (
            <>
              <h2>6. Parcelamento e manejo</h2>
              <ol style={{ fontSize: 13.5 }}>
                {ctx.culturaParc.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
              </ol>
              <p style={{ fontSize: 13 }}>{ctx.culturaObs}</p>
            </>
          )}
        </>
      )}

      <div className="assina">
        <hr />
        <b>{ctx.consultor.nome}</b><br />
        Engenheiro(a) Agrônomo(a) — CREA {ctx.consultor.crea}
      </div>
    </div>
  );
}
