import { describe, it, expect } from 'vitest';
import { avaliarGessagem } from '../src/gessagem.js';
import { calcular } from '../src/calculos.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA, SOLO_BOM } from './fixtures/casos.js';

describe('avaliarGessagem', () => {
  it('indica investigar quando há alumínio na camada superficial', () => {
    const r = calcular(LATOSSOLO_COLATINA, PADRAO);
    const g = avaliarGessagem(LATOSSOLO_COLATINA, r);
    expect(g.precisa).toBe(true);
    expect(g.dose).toBe(50 * 42); // 2100 kg/ha, referência grosseira
    expect(g.criterio).toMatch(/20.40 cm/);
  });

  it('não indica quando o perfil superficial está limpo', () => {
    const r = calcular(SOLO_BOM, PADRAO);
    const g = avaliarGessagem(SOLO_BOM, r);
    expect(g.precisa).toBe(false);
  });
});
