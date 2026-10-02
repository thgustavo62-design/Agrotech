import { describe, expect, it } from 'vitest';
import { gerarSenha, nivelDaSenha, regrasDaSenha } from './senha';

describe('senha', () => {
  it('regras: tamanho e mistura de letras e números', () => {
    expect(regrasDaSenha('abc').map((r) => r.ok)).toEqual([false, false]);
    expect(regrasDaSenha('abcdefghij').map((r) => r.ok)).toEqual([true, false]);
    expect(regrasDaSenha('abcdefghi1').every((r) => r.ok)).toBe(true);
    expect(regrasDaSenha('1234567890').map((r) => r.ok)).toEqual([true, false]);
    expect(regrasDaSenha('abcdefg1').every((r) => r.ok)).toBe(true); // 8 caracteres: o mínimo
    expect(regrasDaSenha('abcdef1').map((r) => r.ok)).toEqual([false, true]); // 7: curta
  });

  it('nível cresce com comprimento e variedade', () => {
    expect(nivelDaSenha('')).toBe(0);
    expect(nivelDaSenha('abc')).toBe(1);
    expect(nivelDaSenha('abcdefghij')).toBe(1);
    expect(nivelDaSenha('Abcdefghij')).toBe(2);
    expect(nivelDaSenha('Abcdefg1!')).toBe(3);
    expect(nivelDaSenha('Abcdefghijklm1!')).toBe(4);
  });
});

describe('gerarSenha', () => {
  it('sempre passa nas regras, no tamanho pedido e sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const senha = gerarSenha();
      expect(senha).toHaveLength(10);
      expect(regrasDaSenha(senha).every((r) => r.ok)).toBe(true);
      expect(senha).not.toMatch(/[0O1lI]/);
    }
    expect(gerarSenha(3)).toHaveLength(8); // nunca menor que o mínimo
    expect(gerarSenha(14)).toHaveLength(14);
  });

  it('não repete', () => {
    const todas = new Set(Array.from({ length: 50 }, () => gerarSenha()));
    expect(todas.size).toBe(50);
  });
});
