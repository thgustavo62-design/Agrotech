import { describe, expect, it } from 'vitest';
import { nivelDaSenha, regrasDaSenha } from './senha';

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
