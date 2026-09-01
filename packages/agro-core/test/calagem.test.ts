import { describe, it, expect } from 'vitest';
import {
  fatorY, fatorProfundidade, calcularCalagem, escolherCorretivo,
} from '../src/calagem.js';
import { calcular } from '../src/calculos.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA } from './fixtures/casos.js';

const conilon = PADRAO.culturas['cafe-conilon'];

describe('fatores', () => {
  it('Y varia com a textura', () => {
    expect(fatorY(70)).toBe(4);
    expect(fatorY(42)).toBe(3);
    expect(fatorY(20)).toBe(2);
    expect(fatorY(9)).toBe(1);
  });

  it('fator de profundidade 1,0 / 1,5 / 2,0', () => {
    expect(fatorProfundidade(20)).toBe(1);
    expect(fatorProfundidade(30)).toBe(1.5);
    expect(fatorProfundidade(40)).toBe(2);
  });
});

describe('calcularCalagem', () => {
  const r = calcular(LATOSSOLO_COLATINA, PADRAO);

  it('roda os dois métodos e adota o maior', () => {
    const c = calcularCalagem(LATOSSOLO_COLATINA, r, conilon, 80, 20);
    expect(c.nc_sb).toBeCloseTo(3.259, 2);
    expect(c.nc_al).toBeCloseTo(2.179, 2);
    expect(c.escolhido).toBeCloseTo(3.259, 2);
    expect(c.Y).toBe(3);
  });

  it('corrige pelo PRNT e pela profundidade de incorporação', () => {
    const c20 = calcularCalagem(LATOSSOLO_COLATINA, r, conilon, 80, 20);
    expect(c20.corrigido).toBeCloseTo(4.074, 2); // 3,259 * (100/80) * 1

    const c40 = calcularCalagem(LATOSSOLO_COLATINA, r, conilon, 80, 40);
    expect(c40.corrigido).toBeCloseTo(8.148, 2); // idem * 2
  });

  it('PRNT ausente cai para o padrão de 85%', () => {
    const c = calcularCalagem(LATOSSOLO_COLATINA, r, conilon, 0, 20);
    expect(c.corrigido).toBeCloseTo(3.834, 2); // 3,259 * (100/85)
  });
});

describe('escolherCorretivo — auditoria A1 (regra estava invertida no protótipo)', () => {
  it('indica DOLOMÍTICO quando falta magnésio, mesmo com Ca/Mg aparentemente ok', () => {
    // Ca 1,2 / Mg 0,3 -> Ca/Mg = 4,0 (não é "larga"), mas Mg < 0,9
    const r = calcular(LATOSSOLO_COLATINA, PADRAO);
    const e = escolherCorretivo(LATOSSOLO_COLATINA, r);
    expect(e.corretivo).toBe('dolomitico');
  });

  it('indica DOLOMÍTICO quando a relação é larga (muito Ca, pouco Mg)', () => {
    const a = { Ca: '4,0', Mg: '0,7', K: '40', HAl: '3' };
    const e = escolherCorretivo(a, calcular(a, PADRAO));
    expect(e.corretivo).toBe('dolomitico');
  });

  it('indica CALCÍTICO quando Ca/Mg é baixo e Mg está adequado', () => {
    const a = { Ca: '2,0', Mg: '1,6', K: '40', HAl: '3' }; // Ca/Mg = 1,25
    const e = escolherCorretivo(a, calcular(a, PADRAO));
    expect(e.corretivo).toBe('calcitico');
  });

  it('indica MAGNESIANO na faixa equilibrada com Mg adequado', () => {
    const a = { Ca: '3,0', Mg: '1,0', K: '40', HAl: '3' }; // Ca/Mg = 3,0
    const e = escolherCorretivo(a, calcular(a, PADRAO));
    expect(e.corretivo).toBe('magnesiano');
  });
});
