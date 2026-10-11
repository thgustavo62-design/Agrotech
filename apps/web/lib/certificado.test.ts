import { describe, expect, it } from 'vitest';
import { enderecoDeConferencia, normalizarCodigo } from './certificado';

describe('normalizar o código digitado', () => {
  it('aceita o jeito certo e variações comuns', () => {
    for (const entrada of ['AT-1A2B3-C4D5E', 'at-1a2b3-c4d5e', '  AT-1A2B3-C4D5E  ', 'AT 1A2B3 C4D5E', 'AT–1A2B3–C4D5E', 'AT—1A2B3—C4D5E', 'at1a2b3c4d5e', 'AT1A2B3-C4D5E']) {
      expect(normalizarCodigo(entrada), entrada).toBe('AT-1A2B3-C4D5E');
    }
  });
  it('o que não parece código volta limpo, para o formato acusar o erro', () => {
    expect(normalizarCodigo('AT-1A2B3')).toBe('AT-1A2B3');
    expect(normalizarCodigo("x' or 1=1")).toBe("X'OR1=1");
    expect(normalizarCodigo('AT-GGGGG-HHHHH')).toBe('AT-GGGGG-HHHHH');
    expect(normalizarCodigo('')).toBe('');
  });
});

describe('endereço de conferência', () => {
  it('monta com a base do site (com ou sem barra final) e codifica o código', () => {
    expect(enderecoDeConferencia('https://agrotech.exemplo.com.br/', 'AT-1A2B3-C4D5E')).toBe('https://agrotech.exemplo.com.br/validar?codigo=AT-1A2B3-C4D5E');
    expect(enderecoDeConferencia('', 'AT-1A2B3-C4D5E')).toBe('/validar?codigo=AT-1A2B3-C4D5E');
    expect(enderecoDeConferencia(null, 'a b')).toBe('/validar?codigo=a%20b');
  });
});
