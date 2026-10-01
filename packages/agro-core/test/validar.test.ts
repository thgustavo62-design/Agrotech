import { describe, it, expect } from 'vitest';
import { validarCultura } from '../src/tabelas/validar.js';
import { PADRAO } from '../src/tabelas/padrao.js';

describe('validarCultura', () => {
  it('toda cultura do padrão é válida e sem aviso', () => {
    for (const c of Object.values(PADRAO.culturas)) {
      const r = validarCultura(c);
      expect(r.erros, c.nome).toEqual([]);
      expect(r.avisos, c.nome).toEqual([]);
    }
  });

  const base = PADRAO.culturas['milho']!;

  it('rejeita valores que quebram o motor', () => {
    expect(validarCultura({ ...base, ref: 0 }).erros).toHaveLength(1);
    expect(validarCultura({ ...base, V2: 120 }).erros).toHaveLength(1);
    expect(validarCultura({ ...base, m_max: -1 }).erros).toHaveLength(1);
    expect(validarCultura({ ...base, N: Number.NaN }).erros).toHaveLength(1);
    expect(validarCultura({ ...base, P: [1, 2, 3, 4, -5] }).erros).toHaveLength(1);
    expect(validarCultura({ ...base, nome: ' ' }).erros).toHaveLength(1);
  });

  it('avisa, sem bloquear, quando a dose sobe em solo mais rico', () => {
    const r = validarCultura({ ...base, K: [10, 20, 30, 40, 50] });
    expect(r.erros).toEqual([]);
    expect(r.avisos).toHaveLength(1);
  });
});

describe('validarQuebras', () => {
  it('todas as faixas e a tabela de fósforo do padrão são válidas', async () => {
    const { validarQuebras } = await import('../src/tabelas/validar.js');
    for (const [chave, f] of Object.entries(PADRAO.faixas)) {
      if (f.q) expect(validarQuebras(chave, f.q), chave).toEqual([]);
    }
    for (const x of PADRAO.fosforo) expect(validarQuebras(x.argila, x.q), x.argila).toEqual([]);
  });

  it('rejeita corte repetido, decrescente, negativo, NaN e quantidade errada', async () => {
    const { validarQuebras } = await import('../src/tabelas/validar.js');
    expect(validarQuebras('K', [15, 40, 40, 120])).toHaveLength(1);
    expect(validarQuebras('K', [15, 40, 30, 120])).toHaveLength(1);
    expect(validarQuebras('K', [-1, 40, 70, 120])).toHaveLength(1);
    expect(validarQuebras('K', [15, Number.NaN, 70, 120])).toHaveLength(1);
    expect(validarQuebras('K', [15, 40, 70])).toHaveLength(1);
    expect(validarQuebras('K', [15, 40, 70, 120])).toEqual([]);
  });
});
