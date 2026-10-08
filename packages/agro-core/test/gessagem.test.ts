import { describe, it, expect } from 'vitest';
import { avaliarGessagem, situacaoDaGessagem } from '../src/gessagem.js';
import { calcular } from '../src/calculos.js';
import { gerarRecomendacao } from '../src/recomendacao.js';
import { normalizarCamada, validarCamadaParaRecomendar } from '../src/camada.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA, SOLO_BOM } from './fixtures/casos.js';

const r = (a: typeof SOLO_BOM) => calcular(a, PADRAO);
// subsuperfície (20-40 cm) com alumínio alto e pouco cálcio
const SUB_RUIM = { ...SOLO_BOM, argila: '42', Ca: '0,3', Mg: '0,2', K: '20', Al: '1,4', HAl: '5' };
// subsuperfície sadia
const SUB_BOA = { ...SOLO_BOM, Ca: '2,0', Mg: '0,8', K: '40', Al: '0', HAl: '2' };

describe('avaliarGessagem — sem análise de 20–40 cm', () => {
  it('camada superficial com alumínio → só "investigar", NENHUMA dose', () => {
    const g = avaliarGessagem(LATOSSOLO_COLATINA, r(LATOSSOLO_COLATINA));
    expect(g.situacao).toBe('investigar_subsuperficie');
    expect(g.precisa).toBe(true);
    expect(g.dose).toBeNull();
    expect(g.criterio).toMatch(/20.40 cm/);
  });

  it('perfil superficial limpo → sem indicação e sem dose', () => {
    const g = avaliarGessagem(SOLO_BOM, r(SOLO_BOM));
    expect(g).toMatchObject({ situacao: 'sem_indicacao', precisa: false, dose: null });
  });
});

describe('avaliarGessagem — com análise de 20–40 cm', () => {
  it('subsuperfície confirma (Ca < 0,5 ou m > 20%) → aprovada, dose = 50 × % de argila', () => {
    const g = avaliarGessagem(LATOSSOLO_COLATINA, r(LATOSSOLO_COLATINA), { analise: SUB_RUIM, dataColeta: '2026-03-01' });
    expect(g.situacao).toBe('aprovada');
    expect(g.dose).toBe(50 * 42);
    expect(g.subsuperficie).toMatchObject({ dataColeta: '2026-03-01', Ca: 0.3 });
    expect(g.subsuperficie!.m).toBeGreaterThan(20);
  });

  it('subsuperfície NÃO confirma → sem indicação, mesmo com a superfície ácida', () => {
    const g = avaliarGessagem(LATOSSOLO_COLATINA, r(LATOSSOLO_COLATINA), { analise: SUB_BOA });
    expect(g).toMatchObject({ situacao: 'sem_indicacao', precisa: false, dose: null });
    expect(g.criterio).toMatch(/não confirma/);
  });

  it('a subsuperfície decide mesmo quando a superfície está limpa', () => {
    const g = avaliarGessagem(SOLO_BOM, r(SOLO_BOM), { analise: SUB_RUIM });
    expect(g.situacao).toBe('aprovada');
  });

  it('subsuperfície incompleta é ignorada — nunca preenchida com zero', () => {
    const { Ca, ...semCa } = SUB_RUIM;
    void Ca;
    const g = avaliarGessagem(LATOSSOLO_COLATINA, r(LATOSSOLO_COLATINA), { analise: semCa });
    expect(g.situacao).toBe('investigar_subsuperficie');
    expect(g.dose).toBeNull();
    expect(g.criterio).toMatch(/incompleta.*Ca/);
    // e, com a superfície limpa, o aviso não inventa necessidade
    expect(avaliarGessagem(SOLO_BOM, r(SOLO_BOM), { analise: semCa }).situacao).toBe('sem_indicacao');
  });
});

describe('totais da recomendação', () => {
  const rec = (sub?: Parameters<typeof avaliarGessagem>[2]) =>
    gerarRecomendacao({ analise: LATOSSOLO_COLATINA, tabelas: PADRAO, areaHa: 10, subsuperficie: sub ?? null });

  it('gesso só entra no total (t) quando aprovada', () => {
    expect(rec().totais.gesso_t).toBe(0);
    expect(rec({ analise: SUB_BOA }).totais.gesso_t).toBe(0);
    expect(rec({ analise: SUB_RUIM }).totais.gesso_t).toBeCloseTo((2100 * 10) / 1000, 6);
  });
});

describe('situacaoDaGessagem (recomendações antigas, sem o campo novo)', () => {
  it('dose antiga nunca vira prescrição', () => {
    expect(situacaoDaGessagem({ precisa: true })).toBe('investigar_subsuperficie');
    expect(situacaoDaGessagem({ precisa: false })).toBe('sem_indicacao');
    expect(situacaoDaGessagem({ situacao: 'aprovada' })).toBe('aprovada');
  });
});

describe('camada × metodologia', () => {
  it('normaliza as formas de escrever a profundidade', () => {
    for (const s of ['0-20', '0–20', '0 - 20 cm', '0-20cm']) expect(normalizarCamada(s), s).toBe('0-20');
    expect(normalizarCamada('20–40 cm')).toBe('20-40');
    expect(normalizarCamada('0-40')).toBe('0-40');
    expect(normalizarCamada('10-30')).toBeNull();
    expect(normalizarCamada('')).toBeNull();
  });

  it('só 0–20 cm gera recomendação; 20–40, 0–40 e desconhecida são recusadas com explicação', () => {
    expect(validarCamadaParaRecomendar('0-20').ok).toBe(true);
    const sub = validarCamadaParaRecomendar('20-40');
    expect(sub.ok).toBe(false);
    expect(!sub.ok && sub.mensagem).toMatch(/gessagem/);
    const comp = validarCamadaParaRecomendar('0–40 cm');
    expect(!comp.ok && comp.mensagem).toMatch(/composta/);
    const x = validarCamadaParaRecomendar('10-30');
    expect(!x.ok && x.camada).toBeNull();
    expect(validarCamadaParaRecomendar(undefined).ok).toBe(false);
  });
});
