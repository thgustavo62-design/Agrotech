import { describe, expect, it } from 'vitest';
import { validarAnalise } from '@agrotech/agro-core';
import { mensagemDeBloqueio } from './analise-validacao';

describe('mensagemDeBloqueio', () => {
  it('lista o que falta e o que é inválido, e cabe no aviso de 300 caracteres', () => {
    const a = { pH: '62', P: '4' };
    const msg = mensagemDeBloqueio(validarAnalise(a), a);
    expect(msg).toMatch(/faltam .*Cálcio \(Ca\).*Magnésio/);
    expect(msg).toMatch(/valor inválido em pH/);
    expect(msg.length).toBeLessThanOrEqual(300);
  });
  it('análise vazia também cabe', () => {
    expect(mensagemDeBloqueio(validarAnalise({}), {}).length).toBeLessThanOrEqual(300);
  });
  it('sem problema, sem mensagem', () => {
    const ok = { pH: 5, argila: 30, P: 5, K: 50, Ca: 2, Mg: 1, Al: 0, HAl: 3 };
    expect(mensagemDeBloqueio(validarAnalise(ok), ok)).toBe('');
  });
});
