import { describe, expect, it } from 'vitest';
import { escolherAmostra, paraDataInput, tomConfianca, type AmostraExtraida } from './laudo-conferencia';

const amostra = (indice: number): AmostraExtraida => ({ indice, numero_lab: null, rotulo: `A${indice}`, campos: {}, extras: {} });

describe('tomConfianca', () => {
  it('classifica pelo limiar de conferência (0,9 / 0,8)', () => {
    expect(tomConfianca(0.98)).toEqual({ tom: 'ok', txt: '98% confiança' });
    expect(tomConfianca(0.9).tom).toBe('ok');
    expect(tomConfianca(0.85)).toEqual({ tom: 'alerta', txt: '85% — confira' });
    expect(tomConfianca(0.6)).toEqual({ tom: 'ruim', txt: '60% — confira' });
    expect(tomConfianca(undefined)).toEqual({ tom: 'cinza', txt: 'não encontrado' });
  });
});

describe('paraDataInput', () => {
  it('converte dd/mm/aaaa e ISO, e devolve vazio para o resto', () => {
    expect(paraDataInput('Data Entrada: 10/06/2026')).toBe('2026-06-10');
    expect(paraDataInput('2026-06-10T12:00')).toBe('2026-06-10');
    expect(paraDataInput('sem data')).toBe('');
    expect(paraDataInput(null)).toBe('');
  });
});

describe('escolherAmostra', () => {
  const tres = [amostra(1), amostra(2), amostra(3)];
  it('laudo de uma amostra só não usa seleção', () => {
    expect(escolherAmostra([amostra(1)], 1, new Set())).toBeUndefined();
  });
  it('a pedida na URL vence', () => {
    expect(escolherAmostra(tres, 2, new Set())!.indice).toBe(2);
  });
  it('sem pedido válido, a primeira ainda não confirmada', () => {
    expect(escolherAmostra(tres, Number.NaN, new Set([1]))!.indice).toBe(2);
    expect(escolherAmostra(tres, 99, new Set([1, 2]))!.indice).toBe(3);
  });
  it('tudo confirmado volta para a primeira', () => {
    expect(escolherAmostra(tres, Number.NaN, new Set([1, 2, 3]))!.indice).toBe(1);
  });
});
