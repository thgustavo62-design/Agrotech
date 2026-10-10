import { describe, expect, it } from 'vitest';
import { contarPorMes, contarSituacao, escalaDoEixo, fatiasDaRosca, ultimosMeses } from './painel-series';

describe('últimos meses', () => {
  it('6 meses até o atual, do mais antigo ao mais novo', () => {
    expect(ultimosMeses('2026-10-09').map((m) => m.chave)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(ultimosMeses('2026-10-09').map((m) => m.rotulo)).toEqual(['mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26']);
  });
  it('atravessa a virada do ano', () => {
    expect(ultimosMeses('2027-02-01', 4).map((m) => m.chave)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(ultimosMeses('2026-01-31', 2).map((m) => m.rotulo)).toEqual(['dez/25', 'jan/26']);
  });
});

describe('contar por mês', () => {
  const meses = ultimosMeses('2026-10-09', 3); // ago, set, out
  it('conta datas e timestamps na janela e ignora o resto', () => {
    const datas = ['2026-08-01', '2026-08-31', '2026-09-15T10:00:00Z', '2026-10-09', '2026-07-31', '2026-11-01', null, undefined, 'lixo', ''];
    expect(contarPorMes(datas, meses)).toEqual([2, 1, 1]);
  });
  it('sem datas devolve zeros', () => {
    expect(contarPorMes([], meses)).toEqual([0, 0, 0]);
  });
});

describe('situação dos talhões', () => {
  it('conta cada situação; o que não se conhece vira "sem análise"', () => {
    expect(contarSituacao(['em_ordem', 'em_ordem', 'precisa_correcao', 'sem_analise', 'outra', null, undefined])).toEqual({ em_ordem: 2, precisa_correcao: 1, sem_analise: 4 });
  });
});

describe('escala do eixo', () => {
  it('topo redondo e marcas iguais', () => {
    expect(escalaDoEixo(7)).toEqual({ topo: 8, marcas: [0, 2, 4, 6, 8] });
    expect(escalaDoEixo(0)).toEqual({ topo: 4, marcas: [0, 1, 2, 3, 4] });
    expect(escalaDoEixo(23)).toEqual({ topo: 40, marcas: [0, 10, 20, 30, 40] });
    expect(escalaDoEixo(120).topo).toBeGreaterThanOrEqual(120);
  });
  it('o topo nunca fica abaixo do maior valor', () => {
    for (const m of [1, 3, 4, 5, 9, 11, 17, 49, 51, 99, 101, 480, 1001]) expect(escalaDoEixo(m).topo, String(m)).toBeGreaterThanOrEqual(m);
  });
});

describe('rosca', () => {
  it('fatias acumuladas de 0 a 1, sem as vazias', () => {
    const f = fatiasDaRosca([2, 0, 2]);
    expect(f).toHaveLength(2);
    expect(f[0]).toEqual({ indice: 0, de: 0, ate: 0.5, pct: 50 });
    expect(f[1]).toEqual({ indice: 2, de: 0.5, ate: 1, pct: 50 });
  });
  it('sem dados não desenha nada', () => {
    expect(fatiasDaRosca([0, 0, 0])).toEqual([]);
    expect(fatiasDaRosca([])).toEqual([]);
  });
});
