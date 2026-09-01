import { describe, it, expect } from 'vitest';
import { calcular, CONV } from '../src/calculos.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA } from './fixtures/casos.js';

describe('complexo sortivo', () => {
  it('converte K de mg/dm³ para cmolc/dm³ dividindo por 391', () => {
    expect(CONV.K).toBe(391);
    const r = calcular({ K: '391' }, PADRAO);
    expect(r.Kc).toBeCloseTo(1, 6);
  });

  it('converte Na dividindo por 230', () => {
    const r = calcular({ Na: '230' }, PADRAO);
    expect(r.Nac).toBeCloseTo(1, 6);
  });

  it('calcula SB, t, T, V% e m% do caso de Colatina conferidos à mão', () => {
    const r = calcular(LATOSSOLO_COLATINA, PADRAO);
    expect(r.SB).toBeCloseTo(1.6023, 3);
    expect(r.t).toBeCloseTo(2.7023, 3);
    expect(r.T).toBeCloseTo(8.1023, 3);
    expect(r.V).toBeCloseTo(19.776, 2);
    expect(r.m).toBeCloseTo(40.706, 2);
  });

  it('deriva as relações Ca/Mg, Ca/K e Mg/K', () => {
    const r = calcular(LATOSSOLO_COLATINA, PADRAO);
    expect(r.CaMg).toBeCloseTo(4.0, 6);
    expect(r.MgK).toBeCloseTo(2.932, 2);
  });

  it('não lança e devolve zeros com análise vazia', () => {
    const r = calcular({}, PADRAO);
    expect(r.V).toBe(0);
    expect(r.m).toBe(0);
    expect(r.SB).toBe(0);
  });

  it('o mesmo P vira classe diferente conforme a argila', () => {
    const arenoso = calcular({ P: '10', argila: '10' }, PADRAO); // faixa 0–15%
    const argiloso = calcular({ P: '10', argila: '70' }, PADRAO); // faixa 60–100%
    expect(arenoso.classeP).toBe(0); // 10 <= 10 -> muito baixo
    expect(argiloso.classeP).toBe(3); // 10 entre 8,0 e 12,0 -> bom
  });
});
