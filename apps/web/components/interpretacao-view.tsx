import {
  gerarRecomendacao, nomeClasse, nomeCorretivo, n,
  type Analise, type Cultura, type TabelasReferencia,
} from '@agrotech/agro-core';
import { f } from '@/lib/formato';
import { Cartao, Grade, Metrica, Tag } from './ui';
import { ReguaInterpretacao } from './regua-interpretacao';
import { PerfilCTC } from './perfil-ctc';

export interface ContextoAnalise {
  produtor?: string;
  talhao?: string;
  areaHa?: number;
  data?: string;
  profundidade?: string;
  prodEsperadaTalhao?: number;
}

const MACRO: Array<[keyof TabelasReferencia['faixas'], keyof Analise]> = [
  ['MO', 'MO'], ['K', 'K'], ['Ca', 'Ca'], ['Mg', 'Mg'], ['Al', 'Al'], ['HAl', 'HAl'],
];
const MICRO: Array<keyof TabelasReferencia['faixas']> = ['S', 'B', 'Zn', 'Cu', 'Mn', 'Fe'];

/**
 * Tela de interpretação e recomendação — o lugar onde o motor aparece inteiro.
 * Presentacional: recebe análise + cultura + tabelas e renderiza. Usada pela
 * rota /app/analises/[id] e pela vitrine /demo.
 */
export function InterpretacaoView({
  analise, cultura, tabelas, contexto = {},
}: {
  analise: Analise;
  cultura?: Cultura;
  tabelas: TabelasReferencia;
  contexto?: ContextoAnalise;
}) {
  const rec = gerarRecomendacao({
    analise,
    ...(cultura ? { cultura } : {}),
    ...(contexto.prodEsperadaTalhao != null ? { prodEsperadaTalhao: contexto.prodEsperadaTalhao } : {}),
    areaHa: contexto.areaHa ?? 0,
    tabelas,
  });

  const { calculo: r, calagem: cal, corretivo, gessagem: ges, adubacao: ad, fontes, diagnostico: dg } = rec;
  const F = tabelas.faixas;
  const V2 = cal.V2;
  const mMax = cultura?.m_max ?? 20;
  const area = contexto.areaHa ?? 0;

  return (
    <>
      <div className="cabecalho-vista">
        <div>
          <span className="olho">
            {contexto.produtor ?? '—'} · {contexto.talhao ?? '—'}
          </span>
          <h1>Interpretação e recomendação</h1>
          <p>
            Coleta de {contexto.data ?? '—'} · camada {contexto.profundidade ?? '0–20'} cm ·{' '}
            {cultura?.nome ?? 'sem cultura'} · {f(area, 1)} ha
          </p>
        </div>
        <div className="acoes">
          <span className="tag cinza">motor {rec.motor_versao}</span>
        </div>
      </div>

      <Grade cols={4}>
        <Metrica rotulo="CTC a pH 7" valor={f(r.T, 2)} detalhe="cmolc/dm³" />
        <Metrica
          rotulo="Saturação por bases"
          valor={`${f(r.V, 0)}%`}
          detalhe={`meta ${V2}%`}
          cor={r.V >= V2 ? 'var(--c-mbom)' : 'var(--c-mb)'}
        />
        <Metrica
          rotulo="Saturação por Al"
          valor={`${f(r.m, 0)}%`}
          detalhe={`limite ${mMax}%`}
          cor={r.m <= mMax ? 'var(--c-mbom)' : 'var(--c-mb)'}
        />
        <Metrica rotulo="Soma de bases" valor={f(r.SB, 2)} detalhe="cmolc/dm³" />
      </Grade>

      <Cartao olho="Ocupação da CTC" titulo="Perfil do complexo sortivo" style={{ marginTop: 12 }}>
        <PerfilCTC analise={analise} calc={r} />
        <Grade cols={3} style={{ marginTop: 14 }}>
          <Metrica rotulo="Ca / Mg" valor={f(r.CaMg, 1)} detalhe="ideal 2 a 5" />
          <Metrica rotulo="Ca / K" valor={f(r.CaK, 1)} detalhe="ideal 9 a 25" />
          <Metrica rotulo="Mg / K" valor={f(r.MgK, 1)} detalhe="ideal 3 a 8" />
        </Grade>
      </Cartao>

      <Cartao olho="Régua de interpretação" titulo="Macronutrientes e acidez">
        <ReguaInterpretacao
          rotulo={F.pH.rot} unidade={F.pH.un} valor={n(analise.pH)} quebras={F.pH.q}
          {...(F.pH.nomes ? { nomes: F.pH.nomes } : {})}
          {...(F.pH.cores ? { cores: F.pH.cores } : {})}
        />
        <ReguaInterpretacao
          rotulo={`Fósforo (argila ${r.faixaP.argila})`} unidade="mg/dm³"
          valor={n(analise.P)} quebras={r.faixaP.q}
        />
        {MACRO.map(([chave, campo]) => (
          <ReguaInterpretacao
            key={chave}
            rotulo={F[chave].rot}
            unidade={F[chave].un}
            valor={n(analise[campo])}
            quebras={F[chave].q}
            invertido={F[chave].inv ?? false}
          />
        ))}
        <ReguaInterpretacao rotulo={F.T.rot} unidade={F.T.un} valor={r.T} quebras={F.T.q} />
        <ReguaInterpretacao rotulo={F.V.rot} unidade={F.V.un} valor={r.V} quebras={F.V.q} />
        <ReguaInterpretacao rotulo={F.m.rot} unidade={F.m.un} valor={r.m} quebras={F.m.q} invertido />

        <h2 style={{ margin: '18px 0 10px' }}>Enxofre e micronutrientes</h2>
        {MICRO.map((chave) => (
          <ReguaInterpretacao
            key={chave}
            rotulo={F[chave].rot}
            unidade={F[chave].un}
            valor={n(analise[chave as keyof Analise])}
            quebras={F[chave].q}
          />
        ))}
      </Cartao>

      <Cartao olho="Leitura agronômica" titulo="Diagnóstico">
        <div className="lista">
          {dg.map((d, i) => (
            <div className="item" key={i}>
              <Tag tom={d.g === 'crit' ? 'ruim' : d.g === 'atencao' ? 'alerta' : 'ok'}>
                {d.g === 'crit' ? 'Crítico' : d.g === 'atencao' ? 'Atenção' : 'Ok'}
              </Tag>
              <div className="cresce">
                <small style={{ fontSize: 13.5, color: 'var(--tinta)' }}>{d.txt}</small>
              </div>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao olho="Correção" titulo="Calagem e gessagem">
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Método</th>
                <th className="num">Dose (t/ha, PRNT 100%)</th>
                <th>Como foi calculado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Saturação por bases</td>
                <td className="num">{f(cal.nc_sb, 2)}</td>
                <td className="nota">({V2} − {f(r.V, 1)}) × {f(r.T, 2)} ÷ 100</td>
              </tr>
              <tr>
                <td>Neutralização do Al + elevação de Ca e Mg</td>
                <td className="num">{f(cal.nc_al, 2)}</td>
                <td className="nota">Y={cal.Y} (argila {f(n(analise.argila), 0)}%), m máx. {mMax}%</td>
              </tr>
              <tr>
                <td><b>Adotado</b></td>
                <td className="num"><b>{f(cal.escolhido, 2)}</b></td>
                <td className="nota">o maior entre os dois</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Grade cols={3} style={{ marginTop: 14 }}>
          <Metrica
            rotulo="Calcário a aplicar"
            valor={`${f(cal.corrigido, 2)} t/ha`}
            detalhe={`PRNT ${n(analise.prnt) || 85}% · 0–${analise.incorp ?? 20} cm`}
          />
          <Metrica rotulo="Total no talhão" valor={`${f(rec.totais.calcario_t, 1)} t`} detalhe={`${f(area, 1)} ha`} />
          <Metrica
            rotulo="Gesso agrícola"
            valor={ges.precisa ? `${f(ges.dose, 0)} kg/ha` : '—'}
            detalhe={ges.precisa ? '50 × % argila (referência)' : 'sem indicação'}
          />
        </Grade>
        <p className="nota" style={{ marginTop: 10 }}>
          <b>{nomeCorretivo(corretivo.corretivo)}.</b> {corretivo.motivo} {ges.criterio} Aplicar com 60 a
          90 dias de antecedência da adubação e com umidade no solo.
        </p>
      </Cartao>

      {ad && cultura ? (
        <Cartao olho="Adubação" titulo={`Recomendação para ${cultura.nome}`}>
          <p className="nota" style={{ margin: '0 0 12px' }}>
            Produtividade esperada de {f(rec.produtividade, 1)} {cultura.un} — fator {f(ad.fator, 2)}× sobre a
            dose de referência.
          </p>
          <Grade cols={3}>
            <Metrica rotulo="Nitrogênio" valor={ad.N} detalhe={`kg/ha de N · ${f(rec.totais.N_kg, 0)} kg no talhão`} />
            <Metrica
              rotulo={`Fósforo — solo ${nomeClasse(ad.classeP).toLowerCase()}`}
              valor={ad.P2O5}
              detalhe={`kg/ha de P₂O₅ · ${f(rec.totais.P2O5_kg, 0)} kg no talhão`}
            />
            <Metrica
              rotulo={`Potássio — solo ${nomeClasse(ad.classeK).toLowerCase()}`}
              valor={ad.K2O}
              detalhe={`kg/ha de K₂O · ${f(rec.totais.K2O_kg, 0)} kg no talhão`}
            />
          </Grade>

          <h3 style={{ margin: '18px 0 8px' }}>Conversão em fertilizante comercial</h3>
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th className="num">Dose (kg/ha)</th>
                  <th className="num">Total no talhão (kg)</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {fontes.map((ft, i) => (
                  <tr key={i}>
                    <td>{ft.nome}</td>
                    <td className="num">{f(ft.dose, 0)}</td>
                    <td className="num">{f(ft.dose * area, 0)}</td>
                    <td className="nota">{ft.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: '18px 0 8px' }}>Parcelamento</h3>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {cultura.parc.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
            ))}
          </ol>
          <p className="nota" style={{ marginTop: 10 }}>{cultura.obs}</p>
        </Cartao>
      ) : null}

      <div className="aviso nao-imprime" style={{ marginTop: 12 }}>
        Recomendação gerada a partir das tabelas cadastradas no app. Confira contra a sua base regional e o
        histórico do talhão antes de entregar. A responsabilidade técnica é de quem assina.
      </div>
    </>
  );
}
