import { describe, it, expect } from 'vitest';
import { calcularAdubacao } from '../src/adubacao.js';
import { calcular } from '../src/calculos.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA } from './fixtures/casos.js';

const conilon = PADRAO.culturas['cafe-conilon']!;

describe('calcularAdubacao', () => {
  const r = calcular(LATOSSOLO_COLATINA, PADRAO);

  it('na produtividade de referência, devolve as doses da tabela pela classe do solo', () => {
    const ad = calcularAdubacao(LATOSSOLO_COLATINA, r, conilon, conilon.ref);
    expect(ad).not.toBeNull();
    expect(ad!.fator).toBe(1);
    expect(ad!.N).toBe(350); // N de referência
    expect(ad!.P2O5).toBe(80); // P classe 0 (muito baixo) -> 80
    expect(ad!.K2O).toBe(280); // K classe 1 (baixo) -> 280
  });

  it('escala linearmente com a produtividade esperada', () => {
    const ad = calcularAdubacao(LATOSSOLO_COLATINA, r, conilon, conilon.ref * 2);
    expect(ad!.fator).toBe(2);
    expect(ad!.N).toBe(700);
    expect(ad!.P2O5).toBe(160);
    expect(ad!.K2O).toBe(560);
  });

  it('sem cultura, não há recomendação de adubação', () => {
    expect(calcularAdubacao(LATOSSOLO_COLATINA, r, undefined, 60)).toBeNull();
  });
});
