import { describe, expect, it } from 'vitest';
import { validarAnalise, lerNumero, informado, gerarRecomendacao, PADRAO } from '../src/index.js';
import { LATOSSOLO_COLATINA, SOLO_BOM } from './fixtures/casos.js';

const campos = (v: ReturnType<typeof validarAnalise>) => v.erros.map((e) => e.campo).sort();

describe('validarAnalise', () => {
  it('análise completa passa; opcionais em branco só ficam como "não informados"', () => {
    expect(validarAnalise(LATOSSOLO_COLATINA)).toMatchObject({ ok: true, erros: [], naoInformados: [] });
    const { B, Zn, ...semMicros } = SOLO_BOM;
    void B; void Zn;
    const v = validarAnalise(semMicros);
    expect(v.ok).toBe(true);
    expect(v.naoInformados.sort()).toEqual(['B', 'Zn']);
  });

  it('análise totalmente vazia: todos os essenciais faltam e nada é aceito', () => {
    const v = validarAnalise({});
    expect(v.ok).toBe(false);
    expect(campos(v)).toEqual(['Al', 'Ca', 'HAl', 'K', 'Mg', 'P', 'argila', 'pH'].sort());
    expect(v.erros[0]!.mensagem).toMatch(/não foi informado/);
  });

  it('um essencial em branco bloqueia (Ca vazio NÃO é cálcio zero)', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      const v = validarAnalise({ ...LATOSSOLO_COLATINA, Ca: vazio });
      expect(v.ok, String(vazio)).toBe(false);
      expect(campos(v)).toEqual(['Ca']);
    }
  });

  it('zero medido é valor legítimo (Al = 0 é comum em solo corrigido)', () => {
    for (const zero of [0, '0', '0,0', '0.00']) {
      expect(validarAnalise({ ...SOLO_BOM, Al: zero }).ok, String(zero)).toBe(true);
    }
  });

  it('texto, negativo e fora da faixa são inválidos', () => {
    expect(campos(validarAnalise({ ...SOLO_BOM, P: 'abc' }))).toEqual(['P']);
    expect(campos(validarAnalise({ ...SOLO_BOM, K: '-5' }))).toEqual(['K']);
    expect(campos(validarAnalise({ ...SOLO_BOM, pH: '62' }))).toEqual(['pH']);
    expect(campos(validarAnalise({ ...SOLO_BOM, Mg: 31 }))).toEqual(['Mg']);
    expect(campos(validarAnalise({ ...SOLO_BOM, B: '25' }))).toEqual(['B']); // opcional, mas informado e impossível
  });

  it('vírgula decimal é aceita; lixo parcial não ("4,8abc")', () => {
    expect(validarAnalise({ ...SOLO_BOM, pH: '4,8' }).ok).toBe(true);
    expect(validarAnalise({ ...SOLO_BOM, pH: '4,8abc' }).ok).toBe(false);
  });
});

describe('lerNumero / informado', () => {
  it('nunca devolve 0 para o que não é número', () => {
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('x')).toBeNull();
    expect(lerNumero(undefined)).toBeNull();
    expect(lerNumero('0')).toBe(0);
    expect(lerNumero('1,5')).toBe(1.5);
    expect(informado(0)).toBe(true);
    expect(informado('')).toBe(false);
    expect(informado(null)).toBe(false);
  });
});

describe('diagnóstico com parâmetros em branco', () => {
  const sem = (...chaves: Array<'MO' | 'S' | 'B' | 'Zn'>) => {
    const a: Record<string, unknown> = { ...SOLO_BOM };
    for (const c of chaves) delete a[c];
    return gerarRecomendacao({ analise: a as typeof SOLO_BOM, tabelas: PADRAO, areaHa: 1 }).diagnostico;
  };

  it('M.O., S, B e Zn em branco NÃO viram "baixo" (antes: zero → deficiência inventada)', () => {
    const txt = sem('MO', 'S', 'B', 'Zn').map((d) => d.txt).join(' | ');
    expect(txt).not.toMatch(/Matéria orgânica baixa|Boro baixo|Zinco baixo|Enxofre baixo/);
    expect(txt).toMatch(/Não informados na análise \(não avaliados\): MO, S, B, Zn/);
    expect(txt).toMatch(/Nenhuma limitação nos parâmetros informados/);
  });

  it('com os valores informados e baixos, os alertas continuam', () => {
    const a = { ...SOLO_BOM, B: '0,1', Zn: '0,2', S: '2', MO: '1' };
    const txt = gerarRecomendacao({ analise: a, tabelas: PADRAO, areaHa: 1 }).diagnostico.map((d) => d.txt).join(' | ');
    expect(txt).toMatch(/Matéria orgânica baixa/);
    expect(txt).toMatch(/Boro baixo/);
    expect(txt).toMatch(/Zinco baixo/);
    expect(txt).toMatch(/Enxofre baixo/);
  });
});
