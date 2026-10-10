import { escalaDoEixo, fatiasDaRosca } from '@/lib/painel-series';

/**
 * Gráficos em SVG puro (sem biblioteca): leves, imprimem bem e leem o tema pelas variáveis do CSS (classes .gr-*).
 * Cada gráfico traz `role="img"` com um resumo em texto e a mesma informação em lista/tabela escondida para leitor de tela.
 */

export interface SerieDeBarras { nome: string; valores: number[]; classe: 's1' | 's2' | 's3' }

const L = 640; // largura do desenho
const A = 250; // altura do desenho
const MARGEM = { topo: 14, direita: 12, base: 32, esquerda: 34 };

/** Barras agrupadas por categoria (ex.: meses), uma barra por série. */
export function BarrasAgrupadas({ categorias, series, resumo }: { categorias: string[]; series: SerieDeBarras[]; resumo: string }) {
  const maximo = Math.max(0, ...series.flatMap((s) => s.valores));
  const { topo, marcas } = escalaDoEixo(maximo);
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = A - MARGEM.topo - MARGEM.base;
  const grupo = larguraUtil / Math.max(1, categorias.length);
  const folga = grupo * 0.22;
  const larguraBarra = Math.min(26, (grupo - folga * 2) / Math.max(1, series.length));
  const y = (v: number) => MARGEM.topo + alturaUtil * (1 - v / topo);

  return (
    <figure className="gr-figura">
      <svg className="gr" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={resumo} preserveAspectRatio="xMidYMid meet">
        {marcas.map((m) => (
          <g key={m}>
            <line className="gr-grade" x1={MARGEM.esquerda} x2={L - MARGEM.direita} y1={y(m)} y2={y(m)} />
            <text className="gr-eixo" x={MARGEM.esquerda - 8} y={y(m) + 4} textAnchor="end">{m}</text>
          </g>
        ))}
        {categorias.map((c, i) => {
          const x0 = MARGEM.esquerda + i * grupo + (grupo - series.length * larguraBarra) / 2;
          return (
            <g key={c}>
              {series.map((s, j) => {
                const v = s.valores[i] ?? 0;
                const h = Math.max(v > 0 ? 3 : 0, alturaUtil * (v / topo));
                return (
                  <rect key={s.nome} className={`gr-barra gr-${s.classe}`} x={x0 + j * larguraBarra} y={MARGEM.topo + alturaUtil - h} width={larguraBarra - 3} height={h} rx={4}>
                    <title>{`${s.nome} em ${c}: ${v}`}</title>
                  </rect>
                );
              })}
              <text className="gr-eixo" x={MARGEM.esquerda + i * grupo + grupo / 2} y={A - 10} textAnchor="middle">{c}</text>
            </g>
          );
        })}
      </svg>
      <ul className="gr-legenda">
        {series.map((s) => (
          <li key={s.nome}><i className={`gr-${s.classe}`} /> {s.nome} <b>{s.valores.reduce((a, b) => a + b, 0)}</b></li>
        ))}
      </ul>
      <table className="gr-tabela-leitor">
        <caption>{resumo}</caption>
        <thead><tr><th>Mês</th>{series.map((s) => <th key={s.nome}>{s.nome}</th>)}</tr></thead>
        <tbody>{categorias.map((c, i) => <tr key={c}><td>{c}</td>{series.map((s) => <td key={s.nome}>{s.valores[i] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}

export interface FatiaDaRosca { nome: string; valor: number; classe: 's1' | 's2' | 's3' | 's4' }

/** Rosca com o total no centro e legenda com quantidade e percentual. */
export function Rosca({ fatias, rotuloCentro, resumo }: { fatias: FatiaDaRosca[]; rotuloCentro: string; resumo: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const desenhadas = fatiasDaRosca(fatias.map((f) => f.valor));
  return (
    <figure className="gr-figura gr-rosca">
      <svg className="gr gr-rosca-svg" viewBox="0 0 200 200" role="img" aria-label={resumo}>
        <circle className="gr-rosca-fundo" cx="100" cy="100" r={R} />
        {desenhadas.map((d) => {
          const f = fatias[d.indice]!;
          const comprimento = (d.ate - d.de) * C;
          return (
            <circle
              key={f.nome}
              className={`gr-fatia gr-${f.classe}`}
              cx="100" cy="100" r={R}
              strokeDasharray={`${Math.max(0, comprimento - (desenhadas.length > 1 ? 2 : 0))} ${C}`}
              strokeDashoffset={-d.de * C}
              transform="rotate(-90 100 100)"
            >
              <title>{`${f.nome}: ${f.valor} (${d.pct}%)`}</title>
            </circle>
          );
        })}
        <text className="gr-centro-num" x="100" y="102" textAnchor="middle">{total}</text>
        <text className="gr-centro-rot" x="100" y="122" textAnchor="middle">{rotuloCentro}</text>
      </svg>
      <ul className="gr-legenda gr-legenda-coluna">
        {fatias.map((f) => (
          <li key={f.nome}>
            <i className={`gr-${f.classe}`} /> <span>{f.nome}</span>
            <b>{f.valor}{total > 0 ? <small> · {Math.round((100 * f.valor) / total)}%</small> : null}</b>
          </li>
        ))}
      </ul>
    </figure>
  );
}
