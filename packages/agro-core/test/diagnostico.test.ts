import { describe, it, expect } from 'vitest';
import { gerarDiagnostico } from '../src/diagnostico.js';
import { calcular } from '../src/calculos.js';
import { PADRAO } from '../src/tabelas/padrao.js';
import { LATOSSOLO_COLATINA, SOLO_BOM } from './fixtures/casos.js';

const conilon = PADRAO.culturas['cafe-conilon'];

describe('gerarDiagnostico', () => {
  it('no caso de Colatina, aponta alumínio, pH, V% e fósforo como críticos', () => {
    const r = calcular(LATOSSOLO_COLATINA, PADRAO);
    const d = gerarDiagnostico(LATOSSOLO_COLATINA, r, conilon, PADRAO);

    const criticos = d.filter((x) => x.g === 'crit').map((x) => x.txt).join(' | ');
    expect(criticos).toMatch(/alum[ií]nio/i);
    expect(criticos).toMatch(/pH abaixo de 5,0/);
    expect(criticos).toMatch(/Satura[çc][ãa]o por bases/i);
    expect(criticos).toMatch(/[Ff][óo]sforo/);
    expect(d.some((x) => x.g === 'ok')).toBe(false);
  });

  it('em solo corrigido, devolve um único item "ok"', () => {
    const r = calcular(SOLO_BOM, PADRAO);
    const d = gerarDiagnostico(SOLO_BOM, r, undefined, PADRAO);
    expect(d).toHaveLength(1);
    expect(d[0]!.g).toBe('ok');
  });
});
