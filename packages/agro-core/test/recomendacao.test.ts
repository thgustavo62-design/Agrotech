import { describe, it, expect } from 'vitest';
import { gerarRecomendacao } from '../src/recomendacao.js';
import { MOTOR_VERSAO } from '../src/versao.js';
import { PADRAO, clonarPadrao } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA } from './fixtures/casos.js';

const conilon = PADRAO.culturas['cafe-conilon'];

describe('gerarRecomendacao', () => {
  const rec = gerarRecomendacao(
    {
      analise: LATOSSOLO_COLATINA,
      cultura: conilon,
      areaHa: 5,
      tabelas: clonarPadrao(),
    },
    new Date('2026-09-01T12:00:00Z'),
  );

  it('carimba a versão do motor e a data', () => {
    expect(rec.motor_versao).toBe(MOTOR_VERSAO);
    expect(rec.gerada_em).toBe('2026-09-01T12:00:00.000Z');
  });

  it('congela um snapshot das tabelas usadas', () => {
    expect(rec.tabelas_snapshot).toEqual(PADRAO);
    expect(rec.tabelas_snapshot).not.toBe(PADRAO);
  });

  it('escolhe dolomítico (auditoria A1) e calcula os totais no talhão', () => {
    expect(rec.corretivo.corretivo).toBe('dolomitico');
    expect(rec.calagem.corrigido).toBeCloseTo(4.074, 2);
    expect(rec.totais.calcario_t).toBeCloseTo(20.369, 2);
  });

  it('traz a adubação e as fontes comerciais', () => {
    expect(rec.adubacao?.N).toBe(350);
    expect(rec.adubacao?.P2O5).toBe(80);
    expect(rec.adubacao?.K2O).toBe(280);
    // enxofre baixo no caso -> superfosfato simples e sulfato de amônio
    const nomes = rec.fontes.map((f) => f.nome).join(' | ');
    expect(nomes).toMatch(/Superfosfato simples/);
    expect(nomes).toMatch(/Sulfato de am[oô]nio/);
  });

  it('o diagnóstico tem pelo menos um item crítico', () => {
    expect(rec.diagnostico.some((d) => d.g === 'crit')).toBe(true);
  });
});
