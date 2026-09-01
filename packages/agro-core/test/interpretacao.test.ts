import { describe, it, expect } from 'vitest';
import {
  classificar, faixaFosforo, classeDe, nomeClasse, ehLimitante,
} from '../src/interpretacao.js';
import { PADRAO } from '../src/tabelas/padrao.js';

describe('classificar', () => {
  it('valor exatamente sobre a quebra permanece na classe inferior', () => {
    // K: quebras [15, 40, 70, 120]
    expect(classificar(40, PADRAO.faixas.K.q)).toBe(1);
    expect(classificar(40.01, PADRAO.faixas.K.q)).toBe(2);
    expect(classificar(15, PADRAO.faixas.K.q)).toBe(0);
    expect(classificar(120, PADRAO.faixas.K.q)).toBe(3);
    expect(classificar(120.5, PADRAO.faixas.K.q)).toBe(4);
  });

  it('sem quebras devolve classe 0', () => {
    expect(classificar(999, null)).toBe(0);
    expect(classificar(1, PADRAO.faixas.P.q)).toBe(0);
  });
});

describe('faixaFosforo', () => {
  it('escolhe a faixa pela classe de argila', () => {
    expect(faixaFosforo(80, PADRAO).argila).toBe('60–100%');
    expect(faixaFosforo(42, PADRAO).argila).toBe('35–60%');
    expect(faixaFosforo(20, PADRAO).argila).toBe('15–35%');
    expect(faixaFosforo(5, PADRAO).argila).toBe('0–15%');
    expect(faixaFosforo(0, PADRAO).argila).toBe('0–15%');
  });
});

describe('classeDe', () => {
  it('P usa a faixa de argila; os demais usam a faixa fixa', () => {
    expect(classeDe('P', 4, PADRAO, 42)).toBe(0);
    expect(classeDe('Ca', 2.4, PADRAO)).toBe(2);
  });
});

describe('nomes e limites', () => {
  it('parâmetro invertido usa Alto / Muito alto no lugar de Bom / Muito bom', () => {
    expect(nomeClasse(3, false)).toBe('Bom');
    expect(nomeClasse(3, true)).toBe('Alto');
    expect(nomeClasse(4, true)).toBe('Muito alto');
  });

  it('ehLimitante marca as duas classes inferiores', () => {
    expect(ehLimitante(0)).toBe(true);
    expect(ehLimitante(1)).toBe(true);
    expect(ehLimitante(2)).toBe(false);
  });
});
