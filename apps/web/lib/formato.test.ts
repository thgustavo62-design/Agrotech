import { describe, expect, it } from 'vitest';
import { dataBR, diasDepoisISO, hojeISO, iniciaisDoNome } from './formato';

describe('hojeISO — fuso de Brasília', () => {
  it('às 22h de Brasília (01h UTC do dia seguinte) ainda é o dia de Brasília', () => {
    // 2026-10-02T01:30Z = 2026-10-01 22:30 em Brasília (UTC-3)
    expect(hojeISO(new Date('2026-10-02T01:30:00Z'))).toBe('2026-10-01');
    // a forma antiga dava o dia errado
    expect(new Date('2026-10-02T01:30:00Z').toISOString().slice(0, 10)).toBe('2026-10-02');
  });
  it('de manhã coincide com o UTC', () => {
    expect(hojeISO(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10-01');
  });
  it('à meia-noite de Brasília vira o dia', () => {
    expect(hojeISO(new Date('2026-10-02T02:59:59Z'))).toBe('2026-10-01');
    expect(hojeISO(new Date('2026-10-02T03:00:00Z'))).toBe('2026-10-02');
  });
});

describe('diasDepoisISO', () => {
  it('soma e subtrai dias civis, inclusive na virada de mês e ano', () => {
    const agora = new Date('2026-12-31T23:00:00Z'); // 20h em Brasília, 31/12
    expect(diasDepoisISO(0, agora)).toBe('2026-12-31');
    expect(diasDepoisISO(1, agora)).toBe('2027-01-01');
    expect(diasDepoisISO(-25, agora)).toBe('2026-12-06');
  });
  it('não pula nem repete dia perto das 21h', () => {
    const agora = new Date('2026-10-02T00:30:00Z'); // 21h30 de 01/10 em Brasília
    expect(diasDepoisISO(0, agora)).toBe('2026-10-01');
    expect(diasDepoisISO(7, agora)).toBe('2026-10-08');
  });
});

describe('dataBR', () => {
  it('formata dd/mm/aaaa e aceita vazio', () => {
    expect(dataBR('2026-10-01')).toBe('01/10/2026');
    expect(dataBR(null)).toBe('—');
  });
});

describe('iniciaisDoNome', () => {
  it('primeira letra do primeiro e do último nome', () => {
    expect(iniciaisDoNome('José da Silva Pereira')).toBe('JP');
    expect(iniciaisDoNome('maria')).toBe('M');
    expect(iniciaisDoNome('  Ana   Paula  ')).toBe('AP');
    expect(iniciaisDoNome('Álvaro Ônix')).toBe('ÁÔ');
  });
  it('sem nome devolve ponto de interrogação', () => {
    expect(iniciaisDoNome('')).toBe('?');
    expect(iniciaisDoNome(null)).toBe('?');
    expect(iniciaisDoNome(undefined)).toBe('?');
  });
});
