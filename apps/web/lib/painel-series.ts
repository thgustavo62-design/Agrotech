/**
 * Regras puras dos gráficos do painel inicial: agrupar datas por mês, contar a situação dos talhões e montar a escala do
 * eixo. Sem acesso a banco nem a relógio (a data de hoje vem de fora), para testar com exemplos fixos.
 */

export interface MesDoGrafico { chave: string; rotulo: string; ano: number; mes: number }

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Os `n` últimos meses até o de `hojeISO` (inclusive), do mais antigo ao mais novo. Chave "2026-10", rótulo "out/26". */
export function ultimosMeses(hojeISO: string, n = 6): MesDoGrafico[] {
  const [a, m] = hojeISO.split('-').map(Number) as [number, number];
  const meses: MesDoGrafico[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = a * 12 + (m - 1) - i;
    const ano = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    meses.push({ chave: `${ano}-${String(mes).padStart(2, '0')}`, rotulo: `${NOMES[mes - 1]}/${String(ano).slice(-2)}`, ano, mes });
  }
  return meses;
}

/** Conta quantas datas (yyyy-mm-dd… ou timestamp ISO) caem em cada mês da janela. Data inválida ou fora da janela é ignorada. */
export function contarPorMes(datas: ReadonlyArray<string | null | undefined>, meses: readonly MesDoGrafico[]): number[] {
  const contagem = new Map(meses.map((m) => [m.chave, 0]));
  for (const d of datas) {
    const chave = typeof d === 'string' && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null;
    if (chave && contagem.has(chave)) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return meses.map((m) => contagem.get(m.chave) ?? 0);
}

export type SituacaoTalhao = 'em_ordem' | 'precisa_correcao' | 'sem_analise';

export const ROTULO_SITUACAO: Record<SituacaoTalhao, string> = {
  em_ordem: 'Em ordem',
  precisa_correcao: 'Precisa de correção',
  sem_analise: 'Sem análise recente',
};

/** Quantos talhões em cada situação (situação desconhecida conta como "sem análise"). */
export function contarSituacao(situacoes: ReadonlyArray<string | null | undefined>): Record<SituacaoTalhao, number> {
  const r: Record<SituacaoTalhao, number> = { em_ordem: 0, precisa_correcao: 0, sem_analise: 0 };
  for (const s of situacoes) {
    if (s === 'em_ordem' || s === 'precisa_correcao') r[s]++;
    else r.sem_analise++;
  }
  return r;
}

/** Topo "redondo" do eixo e as marcas (ex.: máximo 7 → topo 8, marcas 0·2·4·6·8), para o gráfico não terminar em número feio. */
export function escalaDoEixo(maximo: number, marcas = 4): { topo: number; marcas: number[] } {
  const m = Math.max(1, Math.ceil(Number.isFinite(maximo) ? maximo : 1));
  const passo = Math.max(1, Math.ceil(m / marcas));
  // passo "redondo": 1, 2, 5, 10, 20, 50…
  const base = 10 ** Math.floor(Math.log10(passo));
  const frac = passo / base;
  const redondo = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * base;
  const topo = redondo * marcas;
  return { topo, marcas: Array.from({ length: marcas + 1 }, (_, i) => i * redondo) };
}

/** Ângulos acumulados (em fração de 0 a 1) de uma rosca: [{ de, ate }], pulando fatias vazias. */
export function fatiasDaRosca(valores: readonly number[]): Array<{ indice: number; de: number; ate: number; pct: number }> {
  const total = valores.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return [];
  let acumulado = 0;
  const fatias: Array<{ indice: number; de: number; ate: number; pct: number }> = [];
  valores.forEach((v, indice) => {
    if (v <= 0) return;
    const de = acumulado / total;
    acumulado += v;
    fatias.push({ indice, de, ate: acumulado / total, pct: Math.round((100 * v) / total) });
  });
  return fatias;
}
