import {
  gerarRecomendacao, nomeCorretivo,
  type Analise, type Cultura, type TabelasReferencia,
} from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';

export interface DadosLaudo {
  analise: Analise;
  cultura?: Cultura;
  tabelas: TabelasReferencia;
  produtor: string;
  propriedade: string;
  municipio: string;
  talhao: string;
  variedade: string;
  areaHa: number;
  dataColeta: string;
  profundidade: string;
  laboratorio: string;
  prodEsperadaTalhao?: number;
  consultor: { nome: string; crea: string; fone: string; empresa: string };
}

/** Laudo A4 — conteúdo 100% da recomendação (motor_versao + snapshot), nada recalculado. */
export function LaudoView(d: DadosLaudo) {
  const rec = gerarRecomendacao({
    analise: d.analise,
    ...(d.cultura ? { cultura: d.cultura } : {}),
    ...(d.prodEsperadaTalhao != null ? { prodEsperadaTalhao: d.prodEsperadaTalhao } : {}),
    areaHa: d.areaHa,
    tabelas: d.tabelas,
  });
  const a = d.analise;
  const r = rec.calculo;
  const cal = rec.calagem;
  const ad = rec.adubacao;
  const val = (v: unknown) => (v == null || v === '' ? 0 : Number(String(v).replace(',', '.')));

  return (
    <div className="folha-a4">
      <div className="cabecalho">
        <div>
          <h2 style={{ border: 0, padding: 0, margin: 0, fontSize: 22 }}>Laudo de recomendação agronômica</h2>
          <div className="nota">{d.consultor.empresa} · emitido em {dataBR(new Date().toISOString().slice(0, 10))} · motor {rec.motor_versao}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <b>{d.consultor.nome || '—'}</b><br />
          {d.consultor.crea ? `CREA ${d.consultor.crea}` : ''}<br />
          {d.consultor.fone}
        </div>
      </div>

      <h2>1. Identificação</h2>
      <table>
        <tbody>
          <tr><td><b>Produtor</b></td><td>{d.produtor || '—'}</td><td><b>Propriedade</b></td><td>{d.propriedade || '—'}</td></tr>
          <tr><td><b>Município</b></td><td>{d.municipio || '—'}</td><td><b>Talhão</b></td><td>{d.talhao || '—'} · {f(d.areaHa, 1)} ha</td></tr>
          <tr><td><b>Cultura</b></td><td>{d.cultura?.nome ?? '—'}</td><td><b>Variedade</b></td><td>{d.variedade || '—'}</td></tr>
          <tr><td><b>Coleta</b></td><td>{d.dataColeta} · {d.profundidade} cm</td><td><b>Laboratório</b></td><td>{d.laboratorio || '—'}</td></tr>
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

      {ad && d.cultura && (
        <>
          <h2>5. Adubação — produtividade esperada de {f(rec.produtividade, 1)} {d.cultura.un}</h2>
          <table>
            <tbody>
              <tr><th>Nutriente</th><th className="num">kg/ha</th><th className="num">Total ({f(d.areaHa, 1)} ha)</th></tr>
              <tr><td>N</td><td className="num">{ad.N}</td><td className="num">{f(rec.totais.N_kg, 0)} kg</td></tr>
              <tr><td>P₂O₅</td><td className="num">{ad.P2O5}</td><td className="num">{f(rec.totais.P2O5_kg, 0)} kg</td></tr>
              <tr><td>K₂O</td><td className="num">{ad.K2O}</td><td className="num">{f(rec.totais.K2O_kg, 0)} kg</td></tr>
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>Fontes sugeridas</h3>
          <ul style={{ fontSize: 13 }}>
            {rec.fontes.map((ft, i) => (
              <li key={i}>{ft.nome} — {f(ft.dose, 0)} kg/ha ({ft.obs})</li>
            ))}
          </ul>
          <h2>6. Parcelamento e manejo</h2>
          <ol style={{ fontSize: 13.5 }}>
            {d.cultura.parc.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
          </ol>
          <p style={{ fontSize: 13 }}>{d.cultura.obs}</p>
        </>
      )}

      <div className="assina">
        <hr />
        <b>{d.consultor.nome}</b><br />
        Engenheiro(a) Agrônomo(a) — CREA {d.consultor.crea}
      </div>
    </div>
  );
}
